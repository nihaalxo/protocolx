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
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';

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

// Add VR setup at the beginning of the file, after renderer initialization
renderer.xr.enabled = true;

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
  "https://assets.nihaalnazeer.com/models/superherov9.glb",
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
// VR Controller Support for Transition
// ================================================================
let controller1, controller2;

// Add VR camera setup
const vrCamera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
vrCamera.position.set(0, 1.6, 0); // Set initial position at eye level

// Add test cube to scene
const cubeGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
const cubeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
const testCube = new THREE.Mesh(cubeGeo, cubeMat);
testCube.position.set(0, 1.6, -2); // 2m in front of the user's eye height
scene.add(testCube);

// Modify the animation loop
function renderLoop(timestamp, xrFrame) {
    const delta = clock.getDelta();
    
    // Update VR manager
    vrManager.update();

    // Update character controls
    const velocity = characterControls.update(delta, true);

    // Apply movement to camera
    if (velocity) {
        camera.position.x += velocity.x * delta;
        camera.position.y += velocity.y * delta;
        camera.position.z += velocity.z * delta;
    }

    // Render the scene
    composer.render();
}

// Set up the animation loop
renderer.setAnimationLoop(renderLoop);

// Modify the handleVRTransition function
async function handleVRTransition() {
    try {
        // First, request VR session
        const session = await navigator.xr.requestSession('immersive-vr', {
            requiredFeatures: ['local-floor'],
            optionalFeatures: ['bounded-floor']
        });

        // Set the XR session immediately
        renderer.xr.setSession(session);

        // Wait for the session to be fully established
        await new Promise(resolve => {
            session.addEventListener('sessionstart', resolve, { once: true });
        });

        // Load font and create text mesh
        const fontLoader = new FontLoader();
        const font = await new Promise((resolve, reject) => {
            fontLoader.load(
                'https://threejs.org/examples/fonts/helvetiker_regular.typeface.json',
                resolve,
                undefined,
                reject
            );
        });

        // Create a text mesh to verify VR rendering
        const textGeometry = new TextGeometry('VR Test Text', {
            font: font,
            size: 0.2,
            height: 0.05,
        });
        textGeometry.center(); // Center the text
        const textMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const textMesh = new THREE.Mesh(textGeometry, textMaterial);
        
        // Create a group for the text
        const textGroup = new THREE.Group();
        textGroup.add(textMesh);
        scene.add(textGroup);

        // Create a video element
        const transitionVideo = document.createElement('video');
        transitionVideo.muted = false;
        transitionVideo.playsInline = true;
        transitionVideo.volume = 1.0;
        transitionVideo.preload = 'auto';

        // Create a video texture
        const videoTexture = new THREE.VideoTexture(transitionVideo);
        videoTexture.minFilter = THREE.LinearFilter;
        videoTexture.magFilter = THREE.LinearFilter;
        videoTexture.format = THREE.RGBFormat;

        // Create a large screen in VR space
        const screenWidth = 4; // 4 meters wide
        const screenHeight = screenWidth * (9/16); // Maintain 16:9 aspect ratio
        const videoScreen = new THREE.Mesh(
            new THREE.PlaneGeometry(screenWidth, screenHeight),
            new THREE.MeshBasicMaterial({
                map: videoTexture,
                side: THREE.DoubleSide,
                transparent: true
            })
        );

        // Create a group to hold the screen
        const screenGroup = new THREE.Group();
        screenGroup.add(videoScreen);
        scene.add(screenGroup);

        // Function to update positions in VR
        const updatePositions = () => {
            if (renderer.xr.isPresenting) {
                // Get the current XR camera
                const xrCamera = renderer.xr.getCamera(camera);
                
                // Position the screen in front of the camera
                const screenDistance = 3; // 3 meters in front
                screenGroup.position.copy(xrCamera.position);
                screenGroup.quaternion.copy(xrCamera.quaternion);
                
                // Move the screen forward in the direction the camera is facing
                const screenDirection = new THREE.Vector3(0, 0, -1);
                screenDirection.applyQuaternion(xrCamera.quaternion);
                screenGroup.position.add(screenDirection.multiplyScalar(screenDistance));

                // Position the text slightly above the screen
                textGroup.position.copy(xrCamera.position);
                textGroup.quaternion.copy(xrCamera.quaternion);
                
                // Move the text forward and up
                const textDirection = new THREE.Vector3(0, 0, -1);
                textDirection.applyQuaternion(xrCamera.quaternion);
                textGroup.position.add(textDirection.multiplyScalar(screenDistance + 0.5)); // 0.5 meters in front of screen
                textGroup.position.y += 1; // 1 meter above screen
            }
        };

        // Handle VR session end
        session.addEventListener('end', () => {
            // Clean up video and screen
            transitionVideo.pause();
            scene.remove(screenGroup);
            scene.remove(textGroup);
            videoTexture.dispose();
            videoScreen.geometry.dispose();
            videoScreen.material.dispose();
            textGeometry.dispose();
            textMaterial.dispose();
        });

        // Load and play the video with proper error handling
        try {
            // First, fetch the video as a blob
            const response = await fetch('https://assets.nihaalnazeer.com/videos/exitvideo.mp4');
            const blob = await response.blob();

            // Convert blob to base64
            const reader = new FileReader();
            const base64Promise = new Promise((resolve, reject) => {
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });

            // Get the base64 data URL
            const base64DataUrl = await base64Promise;
            
            // Set the video source to the base64 data URL
            transitionVideo.src = base64DataUrl;

            // Wait for video to be ready
            await new Promise((resolve, reject) => {
                transitionVideo.addEventListener('canplaythrough', resolve, { once: true });
                transitionVideo.addEventListener('error', reject, { once: true });
                transitionVideo.load();
            });

            // Ensure audio context is running
            if (typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined') {
                const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                const audioContext = new AudioContextClass();
                if (audioContext.state === 'suspended') {
                    await audioContext.resume();
                }
            }

            // Play the video
            await transitionVideo.play();

            // Handle video end
            transitionVideo.onended = () => {
                // Store VR session state in localStorage
                localStorage.setItem('vrSessionActive', 'true');
                
                // Remove screen and text before transition
                scene.remove(screenGroup);
                scene.remove(textGroup);
                videoTexture.dispose();
                videoScreen.geometry.dispose();
                videoScreen.material.dispose();
                textGeometry.dispose();
                textMaterial.dispose();
                
                // Redirect to interactive world while maintaining VR session
                window.location.href = "/interactive/index.html";
            };

        } catch (error) {
            console.error('Error loading or playing video:', error);
            // If video fails, fall back to normal transition
            const videoOverlay = document.createElement('div');
            videoOverlay.style.position = 'fixed';
            videoOverlay.style.top = '0';
            videoOverlay.style.left = '0';
            videoOverlay.style.width = '100%';
            videoOverlay.style.height = '100%';
            videoOverlay.style.backgroundColor = 'black';
            videoOverlay.style.zIndex = '2000';
            document.body.appendChild(videoOverlay);

            const fallbackVideo = document.createElement('video');
            fallbackVideo.src = 'https://assets.nihaalnazeer.com/videos/exitvideo.mp4';
            fallbackVideo.style.width = '100vw';
            fallbackVideo.style.height = '100vh';
            fallbackVideo.style.objectFit = 'cover';
            fallbackVideo.muted = false;
            fallbackVideo.volume = 1.0;
            videoOverlay.appendChild(fallbackVideo);

            fallbackVideo.play();
            fallbackVideo.onended = () => {
                window.location.href = "/interactive/index.html";
            };
        }

    } catch (error) {
        console.error('Error starting VR session:', error);
        // If VR fails, fall back to normal video transition
        const videoOverlay = document.createElement('div');
        videoOverlay.style.position = 'fixed';
        videoOverlay.style.top = '0';
        videoOverlay.style.left = '0';
        videoOverlay.style.width = '100%';
        videoOverlay.style.height = '100%';
        videoOverlay.style.backgroundColor = 'black';
        videoOverlay.style.zIndex = '2000';
        document.body.appendChild(videoOverlay);

        const transitionVideo = document.createElement('video');
        transitionVideo.src = 'https://assets.nihaalnazeer.com/videos/exitvideo.mp4';
        transitionVideo.style.width = '100vw';
        transitionVideo.style.height = '100vh';
        transitionVideo.style.objectFit = 'cover';
        transitionVideo.muted = false;
        transitionVideo.volume = 1.0;
        videoOverlay.appendChild(transitionVideo);

        transitionVideo.play();
        transitionVideo.onended = () => {
            window.location.href = "/interactive/index.html";
        };
    }
}

// Add click handler to the button
document.querySelector('.press-group').addEventListener('click', (e) => {
    e.preventDefault(); // Prevent default link behavior
    handleVRTransition();
});

// Add F key handler
document.addEventListener("keydown", (event) => {
    if (event.code === "KeyF") {
        handleVRTransition();
    }
});
