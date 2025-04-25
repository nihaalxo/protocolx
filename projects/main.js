new EXRLoader()
  .setDataType(THREE.FloatType)
  .setRequestHeader({
    mode: 'no-cors'
  })
  .load("https://nihaalnazeer.com/hdris/forest.exr", (texture) => {
    const envMap = pmremGenerator.fromEquirectangular(texture).texture;
    scene.environment = envMap;
    texture.dispose();
    pmremGenerator.dispose();
  });

loader.load(
  "https://asset-proxy.nihaalnazeer.workers.dev/models/superherov9.glb",
  (gltf) => {
    const model = gltf.scene;
// ... existing code ...
  }
); 