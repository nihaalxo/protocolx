new EXRLoader()
  .setDataType(THREE.FloatType)
  .load("https://www.nihaalnazeer.com/hdris/forest.exr", (texture) => {
    const envMap = pmremGenerator.fromEquirectangular(texture).texture;
    scene.environment = envMap;
    texture.dispose();
    pmremGenerator.dispose();
  });

loader.load(
  "https://www.nihaalnazeer.com/models/superherov9.glb",
  (gltf) => {
    const model = gltf.scene;
// ... existing code ...
  }
); 