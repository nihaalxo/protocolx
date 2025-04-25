// main.js

// Import Three.js and the necessary examples
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';

// Import post-processing modules for bloom effects
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

// Import our custom character controls (from TS)
import { CharacterControls } from './characterControls';

// -----------------------------------------------------------------
// make every overlay button 58px tall, width auto
// -----------------------------------------------------------------
const style = document.createElement('style');
style.textContent = `
  /* sit/exit overlays */
  #sitOverlay img,
  #exitOverlay img,
  /* choice state buttons */
  img.choice-btn,
  /* resume state button */
  img.resume-btn,
  /* portfolio nav buttons */
  #portBtnOverlay img {
    height: 58px !important;
    width: auto   !important;
  }

  /* Position choice buttons */
  img.choice-btn.left {
    position: fixed;
    bottom: 20px;
    left: 20px;
  }
  img.choice-btn.center {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
  }
  img.choice-btn.right {
    position: fixed;
    bottom: 20px;
    right: 20px;
  }

  /* Position resume button */
  img.resume-btn.bottom-left {
    position: fixed;
    bottom: 20px;
    left: 20px;
  }

  /* Position portfolio buttons */
  #portBtnOverlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
  
  .portfolio-btn.enter {
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
  }
  
  .portfolio-btn.previous {
    position: fixed;
    bottom: 20px;
    left: 20px;
  }
  
  .portfolio-btn.exit {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
  }
  
  .portfolio-btn.next {
    position: fixed;
    bottom: 20px;
    right: 20px;
  }
`;
document.head.appendChild(style);

// -----------------------------------------------------------------
// SCENE, CAMERA, RENDERER, & COMPOSER SETUP
// -----------------------------------------------------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa8def0);

// Update: set near clipping to 0.01
const camera = new THREE.PerspectiveCamera(
  57.5,
  window.innerWidth / window.innerHeight,
  0.01,  // Near clipping set to 0.01
  3000
);
// Initial position (later updated relative to the player)
camera.position.set(0, 3, 3);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.15,  // bloom strength
  0.75,  // bloom radius
  0.95   // bloom threshold
);
composer.addPass(bloomPass);

// -----------------------------------------------------------------
// LIGHTS & ROOM MODEL
// -----------------------------------------------------------------
const ambientLight = new THREE.AmbientLight(0xffffff, 1);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 10, 7.5);
scene.add(directionalLight);

// Set up DracoLoader for mesh compression
const dLoader = new DRACOLoader();
dLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
dLoader.setDecoderConfig({ type: 'js' });

// Create a GLTFLoader and attach the DracoLoader
const loader = new GLTFLoader();
loader.setDRACOLoader(dLoader);

// Load room model (./models/roomv8.glb)
loader.load(
  'https://nihaalnazeer.com/models/roomv8.glb',
  (gltf) => {
    // these are the mesh names in your GLTF you want to drive with video:
    const screenNames = ['news1','news2','news3','wallpaper'];
    const videoFiles  = {
      news1:     'https://nihaalnazeer.com/backgroundvideos/news1loop.mp4',
      news2:     'https://nihaalnazeer.com/backgroundvideos/news2loop.mp4',
      news3:     'https://nihaalnazeer.com/backgroundvideos/news3loop.mp4',
      wallpaper: 'https://nihaalnazeer.com/backgroundvideos/wallpaperloop.mp4',
    };

    scene.add(gltf.scene);

    gltf.scene.traverse(child => {
      if (child.isMesh && screenNames.includes(child.name)) {
        // 1) make <video> element
        const vid = document.createElement('video');
        vid.src         = videoFiles[child.name];
        vid.loop        = true;
        vid.muted       = true;
        vid.playsInline = true;
        vid.crossOrigin = 'anonymous';

        // try to play ASAP
        vid.addEventListener('loadedmetadata', () => {
          vid.play().catch(e => console.warn('Video play error:', e));
        });
        if (vid.readyState >= vid.HAVE_METADATA) {
          vid.play().catch(e => console.warn('Video play error:', e));
        }

        // 2) create VideoTexture
        const videoTex = new THREE.VideoTexture(vid);
        videoTex.minFilter = THREE.LinearFilter;
        videoTex.magFilter = THREE.LinearFilter;
        videoTex.format    = THREE.RGBFormat;
        videoTex.encoding  = THREE.sRGBEncoding;

        // Try first approach: simple flip
        videoTex.flipY = false;

        // If that doesn't work, uncomment this alternative approach:
        // videoTex.center = new THREE.Vector2(0.5, 0.5);
        // videoTex.rotation = Math.PI;
        // videoTex.flipY = true;

        // 3) swap into the mesh's material
        const mat = child.material;
        mat.map = videoTex;
        mat.needsUpdate = true;
        // ensure full opacity
        mat.transparent = false;

        // 4) the video texture will update each frame by default
      }
    });

    // Store debug boxes for collision detection
    const debugBoxes = [];

    // List of mesh names to add debug boxes to
    const debugMeshNames = [
      "col_sofa_1",
      "col_Chair_2",
      "col_Desk",
      "col_wall",
      "col_window",
      "col_wall2",
      "col_wall3",
      "glass",
      "Dumbbell_4",
      "table_1",
      "Ball_1",
      "floor_1",
      "shootingtargets",
      "exitdoor_1",
      "exitdoor_2"
    ];

    // Create debug boxes for specified meshes
    gltf.scene.traverse((child) => {
      if (child.isMesh && debugMeshNames.includes(child.name)) {
        // Create bounding box
        const bbox = new THREE.Box3().setFromObject(child);
        const size = new THREE.Vector3();
        bbox.getSize(size);
        
        // Create invisible box
        const boxGeometry = new THREE.BoxGeometry(size.x, size.y, size.z);
        const boxMaterial = new THREE.MeshBasicMaterial({
          visible: false
        });
        const wireframeBox = new THREE.Mesh(boxGeometry, boxMaterial);
        
        // Position the box at the center of the mesh
        const center = new THREE.Vector3();
        bbox.getCenter(center);
        wireframeBox.position.copy(center);
        wireframeBox.rotation.copy(child.rotation);
        wireframeBox.quaternion.copy(child.quaternion);
        
        // Set the name of the debug box to match the original mesh
        wireframeBox.name = child.name;
        
        // Store box for collision detection
        debugBoxes.push(wireframeBox);
        
        scene.add(wireframeBox);
      }
    });

    // Create invisible ground plane box
    const groundBoxGeometry = new THREE.BoxGeometry(50, 0.02, 50);
    const groundBoxMaterial = new THREE.MeshBasicMaterial({
      visible: false
    });
    const groundBox = new THREE.Mesh(groundBoxGeometry, groundBoxMaterial);
    groundBox.name = "ground_plane";
    groundBox.position.y = 0.01;
    scene.add(groundBox);
    debugBoxes.push(groundBox);

    // Function to check collision between player cylinder and debug boxes
    function checkCollision(playerPosition, radius) {
      for (const box of debugBoxes) {
        // Skip ground plane and floor collisions
        if (box.name === "ground_plane" || box.name === "floor_1") {
          continue;
        }

        const boxBounds = new THREE.Box3().setFromObject(box);
        
        // Create a cylinder bounding box, starting slightly above ground
        const playerBounds = new THREE.Box3();
        playerBounds.min.set(
          playerPosition.x - radius,
          playerPosition.y + 0.1,
          playerPosition.z - radius
        );
        playerBounds.max.set(
          playerPosition.x + radius,
          playerPosition.y + 3,
          playerPosition.z + radius
        );

        if (boxBounds.intersectsBox(playerBounds)) {
          return true;
        }
      }
      return false;
    }

    // Make collision check function available globally
    window.checkCollision = checkCollision;
  },
  (xhr) => {
    const percentLoaded = (xhr.loaded / xhr.total) * 100;
  },
  (error) => {
    // Keep error handler empty but present for stability
  }
);

// -----------------------------------------------------------------
// SET UP POINTER LOCK CONTROLS FOR FIRST-PERSON CAMERA
// -----------------------------------------------------------------
const controls = new PointerLockControls(camera, renderer.domElement);
document.addEventListener('click', () => {
  controls.lock();
}, false);

// -----------------------------------------------------------------
// CHARACTER MODEL & CONTROLS
// -----------------------------------------------------------------
let characterControls = null;

loader.load(
  'https://nihaalnazeer.com/models/player.glb',
  (gltf) => {
    const player = gltf.scene;
    player.rotation.y = Math.PI;
    player.scale.set(1.8, 1.8, 1.8);
    player.position.set(0, 0, 3);
    
    // Exclude face001 mesh
    player.traverse((object) => {
      if (object.isMesh && object.name === 'face001') {
        object.visible = false;
      }
    });
    
    scene.add(player);

    // Create invisible player collision cylinder
    const cylinderGeometry = new THREE.CylinderGeometry(0.25, 0.25, 3, 32);
    const cylinderMaterial = new THREE.MeshBasicMaterial({
      visible: false
    });
    const playerDebugCylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial);
    playerDebugCylinder.position.copy(player.position);
    playerDebugCylinder.position.y = 1.5;
    scene.add(playerDebugCylinder);

    // Create raycaster for crosshair
    const raycaster = new THREE.Raycaster();
    let lastHighlightedMesh = null;

    // Store the last valid position
    let lastValidPosition = player.position.clone();
    
    // Jump variables
    let isJumping = false;
    let jumpVelocity = 0;
    const jumpForce = 0.15;
    const gravity = 0.006;

    // Lightning effect variables
    let lightningLine = null;
    let lightningTarget = null;
    let rightHandBone = null;
    let isLightningActive = false;
    let lastAnimationFrame = null;

    // Find the right hand bone
    player.traverse((object) => {
      if (object.isBone && object.name === 'mixamorigRightHand') {
        rightHandBone = object;
      }
    });

    // Create lightning line
    function createLightningLine() {
      // Create shader material for glowing effect
      const material = new THREE.ShaderMaterial({
        uniforms: {
          color: { value: new THREE.Color(0x00ffff) },
          glowIntensity: { value: 200.0 },
          glowRadius: { value: 20.0 }
        },
        vertexShader: `
          varying vec3 vPosition;
          varying vec2 vUv;
          
          void main() {
            vPosition = position;
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 color;
          uniform float glowIntensity;
          uniform float glowRadius;
          varying vec3 vPosition;
          varying vec2 vUv;
          
          void main() {
            // Create a thicker line effect
            float lineWidth = 0.1; // Controls the thickness of the line
            float dist = abs(vUv.y - 0.5) * 2.0; // Distance from center of line
            float alpha = 1.0 - smoothstep(0.0, lineWidth, dist);
            
            // Create the final color with intense glow
            vec3 finalColor = color * glowIntensity;
            
            // Add cyan core for bloom instead of white
            finalColor += color * 40.0;
            
            gl_FragColor = vec4(finalColor, alpha);
          }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false
      });

      // Create a plane geometry instead of a line for thicker rendering
      const geometry = new THREE.PlaneGeometry(1, 1);
      const line = new THREE.Mesh(geometry, material);
      
      // Make sure the line is rendered before the bloom pass
      line.renderOrder = 1;
      
      return line;
    }

    // Initialize lightning line and sound
    lightningLine = createLightningLine();
    scene.add(lightningLine);

    // Create audio for lightning
    const lightningSound = new Audio('https://nihaalnazeer.com/videos/shootsound.mp3');
    lightningSound.loop = true;
    let wasLightningActive = false;

    // Create audio for walking
    const walkingSound = new Audio('https://nihaalnazeer.com/videos/walkingsound.mp3');
    walkingSound.loop = true;
    let wasWalkingActive = false;

    // Update lightning effect
    function updateLightning() {
      if (!isLightningActive || !rightHandBone || !lightningTarget) {
        if (lightningLine) {
          lightningLine.visible = false;
        }
        if (wasLightningActive) {
          lightningSound.pause();
          lightningSound.currentTime = 0;
          wasLightningActive = false;
        }
        return;
      }

      // Make sure lightning is visible and sound is playing
      lightningLine.visible = true;
      if (!wasLightningActive) {
        lightningSound.play();
        wasLightningActive = true;
      }

      // Get hand position in world space
      const handPosition = new THREE.Vector3();
      rightHandBone.getWorldPosition(handPosition);

      // Create zigzag points between hand and target
      const points = [];
      points.push(handPosition);

      // Number of segments in the lightning
      const segments = 10;
      const direction = new THREE.Vector3().subVectors(lightningTarget, handPosition);
      const segmentLength = direction.length() / segments;
      direction.normalize();

      // Create zigzag points
      for (let i = 1; i < segments; i++) {
        const basePoint = new THREE.Vector3().copy(handPosition).add(
          direction.clone().multiplyScalar(segmentLength * i)
        );
        
        // Add random offset for zigzag effect
        const offset = new THREE.Vector3(
          (Math.random() - 0.5) * 0.2,
          (Math.random() - 0.5) * 0.2,
          (Math.random() - 0.5) * 0.2
        );
        
        points.push(basePoint.add(offset));
      }
      points.push(lightningTarget);

      // Create a series of billboarded planes along the lightning path
      if (lightningLine.geometry) {
        lightningLine.geometry.dispose();
      }
      
      // Create a custom geometry for the lightning path
      const positions = [];
      const uvs = [];
      const indices = [];
      
      // For each segment, create a billboarded plane
      for (let i = 0; i < points.length - 1; i++) {
        const start = points[i];
        const end = points[i + 1];
        
        // Calculate the direction and perpendicular vector
        const segmentDir = new THREE.Vector3().subVectors(end, start).normalize();
        const perp = new THREE.Vector3(0, 1, 0).cross(segmentDir).normalize();
        
        // Create a plane perpendicular to the camera
        const width = 0.1; // Width of the lightning (reduced from 0.2)
        const p1 = new THREE.Vector3().copy(start).add(perp.clone().multiplyScalar(width));
        const p2 = new THREE.Vector3().copy(start).add(perp.clone().multiplyScalar(-width));
        const p3 = new THREE.Vector3().copy(end).add(perp.clone().multiplyScalar(width));
        const p4 = new THREE.Vector3().copy(end).add(perp.clone().multiplyScalar(-width));
        
        // Add vertices
        const baseIndex = positions.length / 3;
        positions.push(p1.x, p1.y, p1.z);
        positions.push(p2.x, p2.y, p2.z);
        positions.push(p3.x, p3.y, p3.z);
        positions.push(p4.x, p4.y, p4.z);
        
        // Add UVs
        uvs.push(0, 0);
        uvs.push(0, 1);
        uvs.push(1, 0);
        uvs.push(1, 1);
        
        // Add indices for two triangles
        indices.push(baseIndex, baseIndex + 1, baseIndex + 2);
        indices.push(baseIndex + 1, baseIndex + 3, baseIndex + 2);
      }
      
      // Create the geometry
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geometry.setIndex(indices);
      
      lightningLine.geometry = geometry;
      lightningLine.geometry.attributes.position.needsUpdate = true;
      lightningLine.geometry.attributes.uv.needsUpdate = true;

      // Create spark effect
      createSparkEffect(lightningTarget);
    }

    // Create spark effect
    function createSparkEffect(position) {
      const sparkCount = 1;
      const sparkGeometry = new THREE.BufferGeometry();
      const sparkMaterial = new THREE.PointsMaterial({
        color: 0x00ffff,
        size: 0.05,
        transparent: true,
        opacity: 1.0,
        blending: THREE.AdditiveBlending,
        toneMapped: false
      });

      // Create initial positions and velocities
      const positions = [];
      const velocities = [];
      
      for (let i = 0; i < sparkCount; i++) {
        // Start all sparks at the impact point
        positions.push(position.x, position.y, position.z);
        
        // Create random direction in 3D space
        const theta = Math.random() * Math.PI * 2; // Horizontal angle
        const phi = Math.random() * Math.PI; // Vertical angle
        const speed = 0.03 + Math.random() * 0.07; // Random speed between 0.03 and 0.1
        
        // Calculate velocity components in 3D space
        velocities.push(
          Math.sin(phi) * Math.cos(theta) * speed, // X velocity
          Math.sin(phi) * Math.sin(theta) * speed, // Y velocity (can be positive or negative)
          Math.cos(phi) * speed  // Z velocity
        );
      }

      // Create the spark system
      sparkGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      const sparks = new THREE.Points(sparkGeometry, sparkMaterial);
      sparks.renderOrder = 1;
      scene.add(sparks);

      // Animation variables
      let startTime = Date.now();
      const lifetime = 100;
      
      // Animation function
      function animateSparks() {
        const elapsed = Date.now() - startTime;
        const progress = elapsed / lifetime;
        
        if (progress >= 1) {
          // Remove the spark system
          scene.remove(sparks);
          sparks.geometry.dispose();
          sparks.material.dispose();
          return;
        }
        
        // Update positions
        const positions = sparks.geometry.attributes.position.array;
        for (let i = 0; i < sparkCount; i++) {
          const baseIndex = i * 3;
          
          // Apply velocity
          positions[baseIndex] += velocities[i * 3];
          positions[baseIndex + 1] += velocities[i * 3 + 1];
          positions[baseIndex + 2] += velocities[i * 3 + 2];
          
          // Apply gravity
          velocities[i * 3 + 1] -= 0.01; // Constant gravity
        }
        
        // Update opacity
        sparks.material.opacity = 1 - progress;
        
        // Update geometry
        sparks.geometry.attributes.position.needsUpdate = true;
        
        // Continue animation
        requestAnimationFrame(animateSparks);
      }
      
      // Start animation
      animateSparks();
    }
    
    // Create overlay for exit door
    const exitOverlay = document.createElement('div');
    exitOverlay.style.position = 'fixed';
    exitOverlay.style.top = '50%';
    exitOverlay.style.left = '50%';
    exitOverlay.style.transform = 'translate(-50%, -50%)';
    exitOverlay.style.zIndex = '1000';
    exitOverlay.style.display = 'none';
    exitOverlay.style.pointerEvents = 'none';
    document.body.appendChild(exitOverlay);

    // Create and add the exit image with correct path
    const exitImage = document.createElement('img');
    exitImage.src = 'https://nihaalnazeer.com/buttonoverlays/exit.png';
    exitImage.style.width = '200px';
    exitImage.style.height = 'auto';
    exitOverlay.appendChild(exitImage);

    // Create overlay for sit action
    const sitOverlay = document.createElement('div');
    sitOverlay.style.position = 'fixed';
    sitOverlay.style.top = '50%';
    sitOverlay.style.left = '50%';
    sitOverlay.style.transform = 'translate(-50%, -50%)';
    sitOverlay.style.zIndex = '1000';
    sitOverlay.style.display = 'none';
    sitOverlay.style.pointerEvents = 'none';
    document.body.appendChild(sitOverlay);

    // Create and add the sit image
    const sitImage = document.createElement('img');
    sitImage.src = 'https://nihaalnazeer.com/buttonoverlays/sit.png';
    sitImage.style.width = '200px';
    sitImage.style.height = 'auto';
    sitOverlay.appendChild(sitImage);

    // Get reference to existing crosshair
    const crosshairElement = document.querySelector('img[src*="crosshairweb.svg"]');

    // Create video overlay (initially hidden)
    const videoOverlay = document.createElement('div');
    videoOverlay.style.position = 'fixed';
    videoOverlay.style.top = '0';
    videoOverlay.style.left = '0';
    videoOverlay.style.width = '100%';
    videoOverlay.style.height = '100%';
    videoOverlay.style.backgroundColor = 'black';
    videoOverlay.style.zIndex = '2000';
    videoOverlay.style.display = 'none';
    document.body.appendChild(videoOverlay);

    // Create video element
    const exitVideo = document.createElement('video');
    exitVideo.src = 'https://nihaalnazeer.com/videos/exitvideo.mp4';
    exitVideo.style.width = '100vw';
    exitVideo.style.height = '100vh';
    exitVideo.style.objectFit = 'cover';
    exitVideo.style.position = 'fixed';
    exitVideo.style.top = '0';
    exitVideo.style.left = '0';
    videoOverlay.appendChild(exitVideo);

    // Create hidden iframe for preloading
    const preloadFrame = document.createElement('iframe');
    preloadFrame.style.display = 'none';
    document.body.appendChild(preloadFrame);

    // Add event listener for video end
    exitVideo.addEventListener('ended', () => {
        window.location.href = '../';
    });

    // Track interaction state
    let inInteraction = false;
    let skipChoiceAnimation = false;

    // Portfolio items list
    const portfolioItems = [
        { image: 'homepage.png',        link: 'https://nihaalnazeer.myportfolio.com/' },
        { image: 'originalmachines.png',link: 'https://nihaalnazeer.myportfolio.com/original-machines-branding' },
        { image: 'visionprofootball.png',link: 'https://nihaalnazeer.myportfolio.com/football-on-the-vision-pro' },
        { image: 'visionpronetflix.png', link: 'https://nihaalnazeer.myportfolio.com/immersive-netflix-for-apples-vision-pro' },
        { image: 'butterflygarden.png', link: 'https://nihaalnazeer.myportfolio.com/butterfly-garden-ui-designanimation' },
        { image: 'visionproinstagram.png', link: 'https://nihaalnazeer.myportfolio.com/apple-vision-instagram-redesign' },
        { image: 'memorypalace.png',    link: 'https://nihaalnazeer.myportfolio.com/memory-palace-blender-animation' },
        { image: 'ehteraz.png',         link: 'https://nihaalnazeer.myportfolio.com/ehteraz-covid-app-redesign' },
        { image: 'shortfilm.png',       link: 'https://nihaalnazeer.myportfolio.com/mind-of-a-designer-short-film' },
        { image: 'telephone.png',       link: 'https://nihaalnazeer.myportfolio.com/telephone-publication-design' },
        { image: 'posters.png',         link: 'https://nihaalnazeer.myportfolio.com/typographic-posters' },
        { image: 'fortuneteller.png',   link: 'https://nihaalnazeer.myportfolio.com/fortune-teller-interactive-pamphlet' },
        { image: 'advocate.png',        link: 'https://nihaalnazeer.myportfolio.com/mental-health-advocate' },
        { image: 'lightdark.png',       link: 'https://nihaalnazeer.myportfolio.com/light-and-dark-animation' },
        { image: 'greenprint.png',      link: 'https://nihaalnazeer.myportfolio.com/green-print-app-design' },
        { image: 'lean.png',            link: 'https://nihaalnazeer.myportfolio.com/lean-website-design' },
        { image: 'escaperoom.png',      link: 'https://nihaalnazeer.myportfolio.com/escape-room-game-design' },
        { image: 'staticaction.png',    link: 'https://nihaalnazeer.myportfolio.com/static-action-animation' },
        { image: 'rgfc.png',            link: 'https://nihaalnazeer.myportfolio.com/rgfc-jersey-design' },
        { image: 'serione.png',         link: 'https://nihaalnazeer.myportfolio.com/silklon-and-serione-branding-design' }
    ];
    let currentPortfolioIndex = 0;

    // Create portfolio overlay
    const portfolioOverlay = document.createElement('div');
    portfolioOverlay.style.position = 'fixed';
    portfolioOverlay.style.top = '0';
    portfolioOverlay.style.left = '0';
    portfolioOverlay.style.width = '100vw';
    portfolioOverlay.style.height = '100vh';
    portfolioOverlay.style.display = 'none';
    portfolioOverlay.style.zIndex = '2001';
    document.body.appendChild(portfolioOverlay);

    // Create portfolio image element
    const portfolioImage = document.createElement('img');
    portfolioImage.style.width = '100vw';
    portfolioImage.style.height = '100vh';
    portfolioImage.style.objectFit = 'contain';
    portfolioImage.style.position = 'absolute';
    portfolioImage.style.top = '50%';
    portfolioImage.style.left = '50%';
    portfolioImage.style.transform = 'translate(-50%, -50%)';
    portfolioOverlay.appendChild(portfolioImage);

    // Create portfolio button overlay
    const portBtnOverlay = document.createElement('div');
    portBtnOverlay.id = 'portBtnOverlay';  // Add ID for CSS targeting
    portBtnOverlay.style.position = 'fixed';
    portBtnOverlay.style.width = '100%';
    portBtnOverlay.style.height = '100%';
    portBtnOverlay.style.display = 'none';
    portBtnOverlay.style.zIndex = '2002';
    document.body.appendChild(portBtnOverlay);

    // Add portfolio navigation buttons with specific classes for positioning
    const portfolioButtons = [
        { name: 'previous', class: 'portfolio-btn previous' },
        { name: 'exitportfolio', class: 'portfolio-btn exit' },
        { name: 'enter', class: 'portfolio-btn enter' },
        { name: 'next', class: 'portfolio-btn next' }
    ];

    portfolioButtons.forEach(btn => {
        const img = document.createElement('img');
        img.src = `https://nihaalnazeer.com/buttonoverlays/${btn.name}.png`;
        img.className = btn.class;
        img.dataset.action = btn.name;
        portBtnOverlay.appendChild(img);
    });

    // --- InteractionManager.js ---
    const InteractionManager = (() => {
        const State = {
            Idle:       "idle",
            Sitting:    "sitting",
            Choice:     "choice",
            Resume:     "resume",
            Portfolio:  "portfolio",
        };
        let currentState = State.Idle;

        // Create / grab the single video and overlay container
        const video = document.createElement("video");
        video.id = "interactionVideo";
        video.style.position = "fixed";
        video.style.top = video.style.left = 0;
        video.style.width = "100vw";
        video.style.height = "100vh";
        video.style.objectFit = "cover";
        video.style.display = "none";
        document.body.appendChild(video);

        const overlay = document.createElement("div");
        overlay.id = "interactionOverlay";
        overlay.style.position = "fixed";
        overlay.style.top = overlay.style.left = 0;
        overlay.style.width = "100%";
        overlay.style.height = "100%";
        overlay.style.pointerEvents = "none";
        overlay.style.display = "none";
        document.body.appendChild(overlay);

        // Disable your characterControls & pointer-lock during interaction
        function setGameEnabled(enabled) {
            controls.enabled = enabled;
        }

        function clearOverlay() {
            overlay.innerHTML = "";
            overlay.style.display = "none";
        }

        function showOverlay(html) {
            overlay.innerHTML = html;
            overlay.style.display = "block";
        }

        function play(src, onEnded) {
            video.src = `https://nihaalnazeer.com/interactiveanimations/${src}`;
            video.style.display = "block";
            video.currentTime = 0;
            video.onended = () => onEnded && onEnded();
            video.play();
        }

        function freezeFrame(state) {
            clearOverlay();                   // Clear any existing overlay first
            video.pause();
            showOverlay(getOverlayHTML(state));
            currentState = state;
        }

        function showChoiceFreeze() {
            clearOverlay();         // make sure there's no old UI
            video.src = "https://nihaalnazeer.com/interactiveanimations/choice.mp4";
            video.style.display = "block";
            video.play().then(() => {
                // immediately pause at the end-of-clip
                video.pause();
                video.currentTime = video.duration;
                freezeFrame(State.Choice);
            });
        }

        function getOverlayHTML(state) {
            switch (state) {
                case State.Choice:
                    return `
                        <img src="https://nihaalnazeer.com/buttonoverlays/viewresume.png" class="choice-btn left" />
                        <img src="https://nihaalnazeer.com/buttonoverlays/stand.png"      class="choice-btn center" />
                        <img src="https://nihaalnazeer.com/buttonoverlays/viewportfolio.png" class="choice-btn right" />
                    `;
                case State.Resume:
                    return `<img src="https://nihaalnazeer.com/buttonoverlays/putdownresume.png" class="resume-btn bottom-left" />`;
                case State.Portfolio:
                    return ""; // nothing for now
                default:
                    return "";
            }
        }

        function enterState(newState) {
            clearOverlay();
            inInteraction = true;
            sitOverlay.style.display = 'none';
            
            switch (newState) {
                case State.Sitting:
                    setGameEnabled(false);
                    skipChoiceAnimation = false; // Reset skip flag when first sitting
                    play("sit.mp4", () => {
                        if (skipChoiceAnimation) {
                            // Skip animation and go straight to choice freeze frame
                            showChoiceFreeze();
                        } else {
                            // Play full choice animation
                            play("choice.mp4", () => freezeFrame(State.Choice));
                        }
                    });
                    break;

                case State.Resume:
                    play("pickupresume.mp4", () => freezeFrame(State.Resume));
                    break;

                case State.Portfolio:
                    play("viewportfolio.mp4", () => {
                        // Show first portfolio image
                        currentPortfolioIndex = 0;
                        portfolioImage.src = `https://nihaalnazeer.com/interactiveimages/${portfolioItems[0].image}`;
                        portfolioOverlay.style.display = 'block';
                        portBtnOverlay.style.display = 'block';
                        freezeFrame(State.Portfolio);
                    });
                    break;
            }
        }

        function exitInteraction() {
            clearOverlay();
            video.style.display = "none";
            currentState = State.Idle;
            inInteraction = false;
            setGameEnabled(true);
        }

        function onKeyDown(e) {
            if (currentState === State.Choice) {
                if (e.key === "q") return enterState(State.Resume);
                if (e.key === "e") return enterState(State.Portfolio);
                if (e.key === "f") {
                    clearOverlay();
                    play("standup.mp4", exitInteraction);
                }
            }
            else if (currentState === State.Resume) {
                if (e.key === "q") {
                    clearOverlay();
                    skipChoiceAnimation = true; // Set skip flag when returning from resume
                    play("resumedown.mp4", () => {
                        // back to choice freeze
                        showChoiceFreeze();
                    });
                }
            }
            else if (currentState === State.Portfolio) {
                switch (e.key.toLowerCase()) {
                    case 'a': // previous
                        currentPortfolioIndex = (currentPortfolioIndex - 1 + portfolioItems.length) % portfolioItems.length;
                        portfolioImage.src = `https://nihaalnazeer.com/interactiveimages/${portfolioItems[currentPortfolioIndex].image}`;
                        break;
                    case 'd': // next
                        currentPortfolioIndex = (currentPortfolioIndex + 1) % portfolioItems.length;
                        portfolioImage.src = `https://nihaalnazeer.com/interactiveimages/${portfolioItems[currentPortfolioIndex].image}`;
                        break;
                    case 'c': // open link
                        window.open(portfolioItems[currentPortfolioIndex].link, '_blank');
                        break;
                    case 'e': // exit back to choice
                        portfolioOverlay.style.display = 'none';
                        portBtnOverlay.style.display = 'none';

                        // play the pre-reversed fade-out clip, then go to choice freeze
                        play("awayportfolio.mp4", () => {
                            showChoiceFreeze();
                        });
                        break;
                }
            }
        }

        function init() {
            document.addEventListener("keydown", onKeyDown);
        }

        return { init, enterState };
    })();

    // Initialize InteractionManager
    InteractionManager.init();

    // Function to check distance to exit doors
    function checkExitDoorDistance(playerPosition) {
        const exitDoors = ['exitdoor_1', 'exitdoor_2'];
        const triggerDistance = 15.0; // Increased from 3.0 to 15.0
        
        for (const doorName of exitDoors) {
            const door = scene.getObjectByName(doorName);
            if (door) {
                console.log(`${doorName} position:`, door.position);
                const distance = playerPosition.distanceTo(door.position);
                console.log(`Distance to ${doorName}:`, distance);
                if (distance <= triggerDistance) {
                    return true;
                }
            }
        }
        return false;
    }

    // Update player debug cylinder position and check crosshair in animation loop
    const originalAnimate = animate;
    animate = function() {
        originalAnimate();
        
        // Handle jumping
        if (keysPressed[' '] && !isJumping) {
            isJumping = true;
            jumpVelocity = jumpForce;
        }
        
        // Apply gravity and update jump
        if (isJumping) {
            jumpVelocity -= gravity;
            player.position.y += jumpVelocity;
            
            // Check if we've landed
            if (player.position.y <= 0) {
                player.position.y = 0;
                isJumping = false;
                jumpVelocity = 0;
            }
        }

        // Check if player is near the exit coordinates (-8.40, 0, -5.54) with 2 unit tolerance
        const isNearExit = 
            Math.abs(player.position.x - (-8.40)) <= 2.0 &&
            Math.abs(player.position.z - (-5.54)) <= 2.0;
        
        // Check if player is near the sit coordinates (-7.60, 0, 1.40) with 2 unit tolerance
        const isNearSit = 
            Math.abs(player.position.x - (-7.60)) <= 2.0 &&
            Math.abs(player.position.z - 1.40) <= 2.0;

        // Show/hide overlays based on position and interaction state
        exitOverlay.style.display = isNearExit ? 'block' : 'none';
        sitOverlay.style.display = (isNearSit && !inInteraction) ? 'block' : 'none';
        
        // Hide crosshair if any other overlay is active
        if (crosshairElement) {
            crosshairElement.style.display = (isNearExit || isNearSit) ? 'none' : 'block';
        }

        // Check for F press while in exit area
        if (isNearExit && keysPressed['f']) {
            // Hide game UI
            exitOverlay.style.display = 'none';
            if (crosshairElement) {
                crosshairElement.style.display = 'none';
            }
            // Show and play video
            videoOverlay.style.display = 'block';
            exitVideo.play();
            // Start preloading the destination page
            preloadFrame.src = '../';
            // Lock controls
            controls.unlock();
        }

        // Check for F press while in sit area - only if not already in interaction
        if (isNearSit && keysPressed['f'] && !inInteraction) {
            // Hide game UI
            sitOverlay.style.display = 'none';
            if (crosshairElement) {
                crosshairElement.style.display = 'none';
            }
            // Start interaction state
            InteractionManager.enterState('sitting');
        }

        // Handle walking sound
        const isMoving = keysPressed['w'] || keysPressed['a'] || keysPressed['s'] || keysPressed['d'];
        if (isMoving && !wasWalkingActive) {
            walkingSound.play();
            wasWalkingActive = true;
        } else if (!isMoving && wasWalkingActive) {
            walkingSound.pause();
            walkingSound.currentTime = 0;
            wasWalkingActive = false;
        }

        // Check for shooting and animation state
        if (shooting) {
            // Update raycaster
            raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
            
            // Get all objects in the scene that we want to check for intersection
            const raycasterObjects = [];
            scene.traverse((object) => {
                // Only include meshes that we want to hit
                if (object.isMesh && 
                    !object.isCamera && 
                    !object.isLight && 
                    object.name !== 'player' &&
                    !object.name.includes('face001') &&
                    object.name !== 'playerDebugCylinder') {
                    raycasterObjects.push(object);
                }
            });
            
            const intersects = raycaster.intersectObjects(raycasterObjects);
            
            if (intersects.length > 0) {
                // Store the intersection point instead of the object
                lightningTarget = intersects[0].point;
                
                // Get the zap animation from the animations map
                const zapAnimation = characterControls.animationsMap.get('zap');
                
                if (zapAnimation) {
                    const progress = zapAnimation.time / zapAnimation.getClip().duration;
                    
                    // Trigger lightning when animation is 80% complete
                    if (progress >= 0.8) {
                        isLightningActive = true;
                        updateLightning();
                    } else {
                        isLightningActive = false;
                        if (wasLightningActive) {
                            lightningSound.pause();
                            lightningSound.currentTime = 0;
                            wasLightningActive = false;
                        }
                        if (lightningLine) {
                            lightningLine.visible = false;
                        }
                    }
                }
            }
        } else {
            isLightningActive = false;
            lightningTarget = null;
            if (wasLightningActive) {
                lightningSound.pause();
                lightningSound.currentTime = 0;
                wasLightningActive = false;
            }
            if (lightningLine) {
                lightningLine.visible = false;
            }
        }

        // Check if the new position would cause a collision
        const newPosition = player.position.clone();
        const hasCollision = window.checkCollision && window.checkCollision(newPosition, 0.25);
        
        if (hasCollision) {
            // Collision detected, revert to last valid position
            player.position.copy(lastValidPosition);
        } else {
            // No collision, update last valid position
            lastValidPosition.copy(player.position);
        }
        
        // Update cylinder position
        playerDebugCylinder.position.copy(player.position);
        playerDebugCylinder.position.y = 1.5;
    };

    const mixer = new THREE.AnimationMixer(player);
    const animationsMap = new Map();
    gltf.animations
      .filter(a => a.name !== 'Tpose')
      .forEach((clip) => {
        animationsMap.set(clip.name.toLowerCase(), mixer.clipAction(clip));
      });

    characterControls = new CharacterControls(
      player,
      mixer,
      animationsMap,
      camera,
      'idle'
    );
  },
  (xhr) => {
    const percentLoaded = (xhr.loaded / xhr.total) * 100;
  },
  (error) => {
    // Keep error handler empty but present for stability
  }
);

// -----------------------------------------------------------------
// INPUT HANDLING: KEYBOARD & MOUSE
// -----------------------------------------------------------------
const keysPressed = {};

document.addEventListener('keydown', (event) => {
  keysPressed[event.key.toLowerCase()] = true;
}, false);

document.addEventListener('keyup', (event) => {
  keysPressed[event.key.toLowerCase()] = false;
}, false);

let shooting = false;
document.addEventListener('mousedown', (event) => {
  if (event.button === 0) {
    shooting = true;
  }
}, false);
document.addEventListener('mouseup', (event) => {
  if (event.button === 0) {
    shooting = false;
  }
}, false);

// -----------------------------------------------------------------
// ANIMATION LOOP
// -----------------------------------------------------------------
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  if (characterControls) {
    characterControls.update(delta, keysPressed, shooting);
  }
  composer.render(delta);
}

animate();

// -----------------------------------------------------------------
// WINDOW RESIZE HANDLING
// -----------------------------------------------------------------
window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (w > 0 && h > 0) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
  }
});

// -----------------------------------------------------------------
// VIDEO PRELOADER
// -----------------------------------------------------------------
window.addEventListener("load", () => {
  const overlay = document.getElementById("video-overlay");
  const video = document.getElementById("preloader-video");
  if (overlay && video) {
    overlay.style.display = "block";
    video.muted = false;
    video.removeAttribute("muted");
    video.currentTime = 0;
    video.play().then(() => {
      console.log("Auto play with sound started.");
    }).catch((error) => {
      console.error("Auto play error:", error);
    });
  }
});

const videoEl = document.getElementById("preloader-video");
videoEl.addEventListener("ended", () => {
  document.getElementById("video-overlay").style.display = "none";
  window.dispatchEvent(new Event("resize"));
});
