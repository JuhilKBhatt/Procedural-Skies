import * as THREE from 'three';
import { loadFBXModel } from './LoadFBXModel.js';

/**
 * Populates the scene with trees, rocks, and seaweed asynchronously based on terrain color.
 * @param {THREE.Scene} scene - The Three.js scene object.
 * @param {THREE.Mesh} terrain - The generated terrain mesh.
 */
export function populateWorld(scene, terrain) {
  const treeModels = [
    'assets/models/tree/TreePine.fbx',
    'assets/models/tree/TreeRound.fbx'
  ];

  const rockModels = [
    'assets/models/rock/Rock1.fbx', 'assets/models/rock/Rock2.fbx', 'assets/models/rock/Rock3.fbx',
    'assets/models/rock/Rock4.fbx', 'assets/models/rock/Rock5.fbx', 'assets/models/rock/Rock6.fbx'
  ];

  const seaWeedModels = [
    'assets/models/river/SeaWeed1.fbx', 'assets/models/river/SeaWeed2.fbx'
  ];

  // Terrain color categories
  const waterColor = new THREE.Color(0x1e3d59);   // Deep Blue
  const beachColor = new THREE.Color(0xc2b280);   // Sand
  const grassLowColor = new THREE.Color(0x2e8b57); // Dark Green
  const grassHighColor = new THREE.Color(0x3cb371); // Light Green
  const rockColor = new THREE.Color(0x808080);    // Gray
  const snowColor = new THREE.Color(0xffffff);    // White

  // Calculate terrain size
  const boundingBox = new THREE.Box3().setFromObject(terrain);
  const terrainWidth = boundingBox.max.x - boundingBox.min.x;
  const terrainDepth = boundingBox.max.z - boundingBox.min.z;

  const batchSize = 20;  // Number of objects loaded per batch
  let currentCluster = 0;

  function loadNextBatch() {
    if (currentCluster >= 100) return;  // Limit clusters to avoid overload

    for (let b = 0; b < batchSize; b++) {
      if (currentCluster >= 100) break;

      // Random center for each cluster within terrain bounds
      const centerX = (Math.random() - 0.5) * terrainWidth;
      const centerZ = (Math.random() - 0.5) * terrainDepth;

      // Raycasting to find the height and color at the center
      const raycaster = new THREE.Raycaster(
        new THREE.Vector3(centerX, 100, centerZ),
        new THREE.Vector3(0, -1, 0)
      );
      const intersects = raycaster.intersectObject(terrain);

      if (intersects.length === 0) continue;
      const intersection = intersects[0];
      const y = intersection.point.y;

      // Get the vertex color at the intersection point
      const color = new THREE.Color();
      const colorArray = terrain.geometry.attributes.color.array;
      const vertexIndex = intersection.face.a * 3;
      color.setRGB(
        colorArray[vertexIndex],
        colorArray[vertexIndex + 1],
        colorArray[vertexIndex + 2]
      );

      let models = [];
      let density = 0;

      // Model selection based on color
      if (color.equals(waterColor)) {
        models = seaWeedModels;
        density = Math.floor(Math.random() * 20) + 20;
      } else if (color.equals(beachColor)) {
        continue; // No objects on the beach
      } else if (color.equals(grassLowColor) || color.equals(grassHighColor)) {
        models = Math.random() < 0.7 ? treeModels : rockModels;
        density = Math.floor(Math.random() * 50) + 50;
      } else if (color.equals(rockColor)) {
        models = rockModels;
        density = Math.floor(Math.random() * 20) + 10;
      } else if (color.equals(snowColor)) {
        continue; // No objects on snow
      }

      // Cluster parameters
      const clusterRadius = Math.random() * 10 + 5;

      for (let t = 0; t < density; t++) {
        // Random offset within the cluster radius
        const angle = Math.random() * 2 * Math.PI;
        const radius = Math.random() * clusterRadius;
        const x = centerX + Math.cos(angle) * radius;
        const z = centerZ + Math.sin(angle) * radius;

        // Raycast again for the specific model position
        const ray = new THREE.Raycaster(
          new THREE.Vector3(x, 100, z),
          new THREE.Vector3(0, -1, 0)
        );
        const hit = ray.intersectObject(terrain);

        let finalY = 0;  // Default ground level if no intersection found
        if (hit.length > 0) {
          finalY = hit[0].point.y;
        }

        // Randomly select a model from the chosen category
        const modelPath = models[Math.floor(Math.random() * models.length)];

        // Place the model at the calculated position
        loadFBXModel(modelPath, new THREE.Vector3(x, finalY, z), scene);
      }

      currentCluster++;
    }

    // Use requestAnimationFrame to spread the load over time
    requestAnimationFrame(loadNextBatch);
  }

  // Start loading in batches
  loadNextBatch();
}