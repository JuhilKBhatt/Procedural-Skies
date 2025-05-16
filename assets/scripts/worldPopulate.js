import * as THREE from 'three';
import { loadFBXModel } from './LoadFBXModel.js';

/**
 * Populates the scene with trees and rocks.
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

  const clusterCount = 10; // Number of forest clusters
  const treesPerCluster = 200; // Trees per cluster
  const clusterRadius = 10; // Radius of each cluster

  for (let i = 0; i < clusterCount; i++) {
    // Random center for the cluster
    const centerX = (Math.random() - 0.5) * 80;
    const centerZ = (Math.random() - 0.5) * 80;

    for (let j = 0; j < treesPerCluster; j++) {
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
      const models = Math.random() > 0.5 ? treeModels : rockModels;
      const modelPath = models[Math.floor(Math.random() * models.length)];

      // Corrected position (x, y, z) for placing the objects
      loadFBXModel(modelPath, new THREE.Vector3(x, y, z), scene);
    }
  }
}