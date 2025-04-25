// main.js (updated with keydown redirect and fix for uniforms cloning error)
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
  .load("https://protocolx.nihaalnazeer.com/hdris/forest.exr", (texture) => {
    const envMap = pmremGenerator.fromEquirectangular(texture).texture;
    scene.environment = envMap; // Apply the HDRI as the environment map
    // Optionally, you can set the background as well:
    // scene.background = envMap;
    texture.dispose();
    pmremGenerator.dispose();
  });

// ================================================================
// Lighting Setup (Three-Point Lighting)
// ================================================================

// 1. Ambient Light (low intensity so key/fill dominate)
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

// 2. Key Light (front-facing to illuminate the face)
//    Adjust the position as needed for optimal face lighting.
const keyLight = new THREE.DirectionalLight(0xffffff, 0);
keyLight.position.set(1, 2, 2);  // From front-right and above
scene.add(keyLight);

// 3. Fill Light (soft light from the opposite side to fill shadows)
const fillLight = new THREE.DirectionalLight(0xffffff, 0);
fillLight.position.set(-1, 1, 2); // From front-left
scene.add(fillLight);

// 4. Rim Light (to accentuate edges, optional)
const rimLight = new THREE.DirectionalLight(0xffffff, 0);
rimLight.position.set(0, 0, -3);  // Behind the model
scene.add(rimLight);

// ================================================================
// Selective Bloom Setup using Layers (unchanged)
// ================================================================
const bloomLayer = new THREE.Layers();
bloomLayer.set(1);

// ================================================================
// Set up DracoLoader for mesh compression
// ================================================================
const dLoader = new DRACOLoader();
// Set the decoder path (adjust as needed, or use a CDN URL)
// If using local installation, you may need to copy Draco files into your public folder.
dLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/'); 
dLoader.setDecoderConfig({ type: 'js' });

// Create a GLTFLoader and attach the DracoLoader
const loader = new GLTFLoader();
loader.setDRACOLoader(dLoader);

let loadedModel = null; // To store our model for scroll-driven rotation

loader.load(
  "https://protocolx.nihaalnazeer.com/interactive/models/superherov9.glb",
  (gltf) => {
    const model = gltf.scene;

    // Center model at its feet
    const box = new THREE.Box3().setFromObject(model);
    const feet = new THREE.Vector3(
      (box.min.x + box.max.x) / 2,
      box.min.y,
      (box.min.z + box.max.z) / 2
    );
    model.position.sub(feet);
    model.scale.set(1.2, 1.2, 1.2);

    // Set initial camera target and position based on model
    const scaledBox = new THREE.Box3().setFromObject(model);
    const modelHeight = scaledBox.max.y - scaledBox.min.y;
    const hips = scaledBox.min.y + modelHeight * 0.5;
    controls.target.set(0, hips, 0);
    camera.position.set(0, hips, 3.8);
    controls.update();

    // Traverse model to boost HDRI reflections and configure bloom
    model.traverse((child) => {
      if (child.isMesh && child.material) {
        // Increase envMapIntensity to let the HDRI affect the material more
        if ("envMapIntensity" in child.material) {
          child.material.envMapIntensity = 3.0; // Adjust this value if needed
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
    loadedModel = model; // Save reference for scroll-driven rotation
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

// ----- FIX: Prevent cloning error -----
// Override the clone method on the render target texture so it simply returns itself.
// This prevents Three.js from attempting to clone a render target texture in uniforms.
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
// Animation Loop – Render the scene
// ================================================================
function animate() {
  requestAnimationFrame(animate);
  controls.update(); // Even though interactions are disabled, damping may still update.
  composer.render();
}
animate();

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
// Scroll Event to Drive Model Rotation
// ================================================================
window.addEventListener("scroll", () => {
  if (loadedModel) {
    const scrollProgress =
      window.scrollY / (document.documentElement.scrollHeight - window.innerHeight);
    loadedModel.rotation.y = scrollProgress * 2 * Math.PI;
  }
});

// ================================================================
// Keydown Event to Redirect on "F" Key Press
// ================================================================
document.addEventListener("keydown", (event) => {
  if (event.code === "KeyF") {
    window.location.href = "/interactive/index.html";
  }
});
