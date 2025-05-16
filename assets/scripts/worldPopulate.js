import * as THREE from 'three';
import { loadFBXModel } from './LoadFBXModel.js';

/**
 * Populates the scene with trees, rocks, and seaweed asynchronously to reduce lag.
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

  // Calculate terrain size
  const boundingBox = new THREE.Box3().setFromObject(terrain);
  const terrainWidth = boundingBox.max.x - boundingBox.min.x;
  const terrainDepth = boundingBox.max.z - boundingBox.min.z;

  // Dynamic cluster settings based on terrain size
  const clusterCount = Math.floor((terrainWidth * terrainDepth) / 1000) + Math.floor(Math.random() * 25);
  const batchSize = 20;  // Number of objects loaded per batch
  let currentCluster = 0;
  let currentTree = 0;

  function loadNextBatch() {
    if (currentCluster >= clusterCount) return;

    for (let b = 0; b < batchSize; b++) {
      if (currentCluster >= clusterCount) break;

      // Random center for each cluster within terrain bounds
      const centerX = (Math.random() - 0.5) * terrainWidth;
      const centerZ = (Math.random() - 0.5) * terrainDepth;

      // Perform raycasting to find the height at the center
      const raycaster = new THREE.Raycaster(
        new THREE.Vector3(centerX, 100, centerZ), // Start ray from above
        new THREE.Vector3(0, -1, 0)   // Pointing downward
      );
      const intersects = raycaster.intersectObject(terrain);

      if (intersects.length === 0) continue;
      const height = intersects[0].point.y;

      // Decide what to spawn based on the height
      let models;
      let density;

      if (height < 3) {
        // Spawn only seaweed in water areas (height < 3)
        models = seaWeedModels;
        density = Math.floor(Math.random() * 20) + 20; // Moderate density for underwater plants
      } else {
        // Higher altitudes: fewer trees, more rocks
        const isHighAltitude = height > 8;
        const treeProbability = isHighAltitude ? 0.2 : 0.7;

        // Mix trees and rocks based on altitude
        models = Math.random() < treeProbability ? treeModels : rockModels;
        density = isHighAltitude ? 20 : Math.floor(Math.random() * 100) + 100;
      }

      const clusterRadius = Math.random() * 10 + 5;

      for (; currentTree < density; currentTree++) {
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

        let y = 0;  // Default ground level if no intersection found
        if (hit.length > 0) {
          y = hit[0].point.y;
        }

        // Randomly select a model from the chosen category
        const modelPath = models[Math.floor(Math.random() * models.length)];

        // Place the model at the calculated position
        loadFBXModel(modelPath, new THREE.Vector3(x, y, z), scene);
      }

      currentTree = 0;
      currentCluster++;
    }

    // Use requestAnimationFrame to spread the load over time
    requestAnimationFrame(loadNextBatch);
  }

  // Start loading in batches
  loadNextBatch();
}