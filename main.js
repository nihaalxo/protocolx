// main.js (with robust Gamepad "A" → "F" redirect)
// ================================================================
import * as THREE from "three";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { EXRLoader } from "three/examples/jsm/loaders/EXRLoader.js";

// ================================================================
// Parameters for bloom and tone mapping
// ================================================================
const params = {
  exposure: 0,          // Overall exposure; adjust if needed
  bloomThreshold: 0.373,
  bloomStrength: 0.2,
  bloomRadius: 1.0,
};

const container = document.getElementById("canvas-container");
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
let width = container.clientWidth;
let height = container.clientHeight;
renderer.setSize(width, height);

// REVERTED TONE MAPPING: Use ReinhardToneMapping instead of ACESFilmicToneMapping
renderer.toneMapping = THREE.ReinhardToneMapping;
renderer.toneMappingExposure = params.exposure;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
// Leave scene.background black to let the HDRI primarily affect lighting.
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(38.6, width / height, 0.1, 1000);
camera.setFocalLength(50);

// ================================================================
// OrbitControls Setup (disabled user interaction)
// ================================================================
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.1;
controls.enableRotate = false;
controls.enableZoom = false;
controls.enablePan = false;

// ================================================================
// Load HDRI Environment using EXRLoader (with FloatType)
// ================================================================
const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();

new EXRLoader()
  .setDataType(THREE.FloatType) // Use FloatType for EXR files
  .load("https://assets.nihaalnazeer.com/hdris/forest.exr", (texture) => {
    const envMap = pmremGenerator.fromEquirectangular(texture).texture;
    scene.environment = envMap; // Apply the HDRI as the environment map
    texture.dispose();
    pmremGenerator.dispose();
  });

// ================================================================
// Lighting Setup (Three-Point Lighting)
// ================================================================
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const keyLight = new THREE.DirectionalLight(0xffffff, 0);
keyLight.position.set(1, 2, 2);
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xffffff, 0);
fillLight.position.set(-1, 1, 2);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(0xffffff, 0);
rimLight.position.set(0, 0, -3);
scene.add(rimLight);

// ================================================================
// Selective Bloom Setup using Layers
// ================================================================
const bloomLayer = new THREE.Layers();
bloomLayer.set(1);

// ================================================================
// Set up DracoLoader for mesh compression
// ================================================================
const dLoader = new DRACOLoader();
dLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
dLoader.setDecoderConfig({ type: 'js' });

const loader = new GLTFLoader();
loader.setDRACOLoader(dLoader);

let loadedModel = null;

loader.load(
  "https://assets.nihaalnazeer.com/models/superherov9.glb",
  (gltf) => {
    const model = gltf.scene;
    // Center at feet
    const box = new THREE.Box3().setFromObject(model);
    const feet = new THREE.Vector3(
      (box.min.x + box.max.x) / 2,
      box.min.y,
      (box.min.z + box.max.z) / 2
    );
    model.position.sub(feet);
    model.scale.set(1.2, 1.2, 1.2);

    // Camera framing
    const scaledBox = new THREE.Box3().setFromObject(model);
    const modelHeight = scaledBox.max.y - scaledBox.min.y;
    const hips = scaledBox.min.y + modelHeight * 0.5;
    controls.target.set(0, hips, 0);
    camera.position.set(0, hips, 3.8);
    controls.update();

    // Traverse for bloom & env intensity
    model.traverse((child) => {
      if (child.isMesh && child.material) {
        if ("envMapIntensity" in child.material) {
          child.material.envMapIntensity = 3.0;
        }
        if (child.userData.bloom === "true") {
          child.layers.enable(1);
          if ("emissive" in child.material) {
            child.material.emissive.setHex(0x00fcff);
            child.material.emissiveIntensity = 100;
          }
        } else {
          child.layers.disable(1);
        }
      }
    });

    scene.add(model);
    loadedModel = model;
  },
  undefined,
  (error) => {
    console.error("Error loading model:", error);
  }
);

// ================================================================
// Postprocessing Setup
// ================================================================
const renderPass = new RenderPass(scene, camera);
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(width, height),
  params.bloomStrength,
  params.bloomRadius,
  params.bloomThreshold
);
const composer = new EffectComposer(renderer);
composer.addPass(renderPass);
composer.addPass(bloomPass);

// Prevent cloning error on render target
composer.renderTarget2.texture.clone = function() {
  return this;
};

const finalPass = new ShaderPass(
  new THREE.ShaderMaterial({
    uniforms: {
      baseTexture: { value: null },
      bloomTexture: { value: composer.renderTarget2.texture },
    },
    vertexShader: document.getElementById("vertexshader").textContent,
    fragmentShader: document.getElementById("fragmentshader").textContent,
  }),
  "baseTexture"
);
finalPass.needsSwap = true;
composer.addPass(finalPass);

// ================================================================
// Handle Window Resize
// ================================================================
window.addEventListener("resize", () => {
  width = container.clientWidth;
  height = container.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  composer.setSize(width, height);
});

// ================================================================
// Scroll-Driven Model Rotation
// ================================================================
window.addEventListener("scroll", () => {
  if (loadedModel) {
    const scrollProgress =
      window.scrollY / (document.documentElement.scrollHeight - window.innerHeight);
    loadedModel.rotation.y = scrollProgress * 2 * Math.PI;
  }
});

// ================================================================
// Keyboard "F" Redirect (desktop)
// ================================================================
document.addEventListener("keydown", (event) => {
  if (event.code === "KeyF") {
    window.location.href = "/interactive/index.html";
  }
});

// ================================================================
// Gamepad "A" → "F" Redirect (Quest controllers)
// ================================================================
let aPressedLast = false;
function pollGamepad() {
  const gps = navigator.getGamepads && navigator.getGamepads();
  if (!gps) return;

  // check ALL connected pads for an A‐press (button index 0)
  let anyA = false;
  for (const gp of gps) {
    if (gp && gp.buttons[0]?.pressed) {
      anyA = true;
      break;
    }
  }

  // on newly pressed A, do redirect
  if (anyA && !aPressedLast) {
    window.location.href = "/interactive/index.html";
  }
  aPressedLast = anyA;
}

// ================================================================
// Animation Loop – Render the scene (with Gamepad polling)
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  pollGamepad();
  composer.render();
}
animate();
