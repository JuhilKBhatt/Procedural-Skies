import * as THREE from 'three';
import { loadFBXModel } from './LoadFBXModel.js';

/**
 * Populates the scene with trees and rocks asynchronously to reduce lag.
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

  // Calculate terrain size
  const boundingBox = new THREE.Box3().setFromObject(terrain);
  const terrainWidth = boundingBox.max.x - boundingBox.min.x;
  const terrainDepth = boundingBox.max.z - boundingBox.min.z;

  // Dynamic cluster settings based on terrain size
  const clusterCount = Math.floor((terrainWidth * terrainDepth) / 1000) + Math.floor(Math.random() * 25);
  const treesPerCluster = Math.floor(Math.random() * 100) + 100;
  const clusterRadius = Math.random() * 10 + 5;

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

      for (; currentTree < treesPerCluster; currentTree++) {
        // Random offset within the cluster radius
        const angle = Math.random() * 2 * Math.PI;
        const radius = Math.random() * clusterRadius;
        const x = centerX + Math.cos(angle) * radius;
        const z = centerZ + Math.sin(angle) * radius;

        // Calculate height using raycasting to align the model with the terrain
        const raycaster = new THREE.Raycaster(
          new THREE.Vector3(x, 100, z), // Start ray from above
          new THREE.Vector3(0, -1, 0)   // Pointing downward
        );
        const intersects = raycaster.intersectObject(terrain);

        let y = 0; // Default to ground level if no intersection found
        if (intersects.length > 0) {
          y = intersects[0].point.y; // Set y to intersection height
        }

        // Randomly choose between tree and rock models
        const models = Math.random() > 0.3 ? treeModels : rockModels;
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