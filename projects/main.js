const textureLoader = new THREE.TextureLoader();
textureLoader.load("https://nihaalnazeer.com/hdris/forest.jpg", (texture) => {
  const envMap = pmremGenerator.fromEquirectangular(texture).texture;
  scene.environment = envMap;
  texture.dispose();
  pmremGenerator.dispose();
});

loader.load(
  "https://nihaalnazeer.com/models/superherov9.glb",
  (gltf) => {
    const model = gltf.scene;
// ... existing code ...
  }
); 