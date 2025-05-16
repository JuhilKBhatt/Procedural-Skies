// worldPopulate.js
import * as THREE from 'three';
import { loadFBXModel } from './LoadFBXModel.js';

/**
 * Populates the scene with trees and rocks.
 * @param {THREE.Scene} scene - The Three.js scene object.
 */
export function populateWorld(scene) {
  // Tree and rock models
  const treeModels = [
    'assets/models/tree/TreePine.fbx',
    'assets/models/tree/TreeRound.fbx'
  ];

  const rockModels = [
    'assets/models/rock/Rock1.fbx', 'assets/models/rock/Rock2.fbx', 'assets/models/rock/Rock3.fbx',
    'assets/models/rock/Rock4.fbx', 'assets/models/rock/Rock5.fbx', 'assets/models/rock/Rock6.fbx',
    'assets/models/rock/Rock7.fbx', 'assets/models/rock/Rock8.fbx', 'assets/models/rock/Rock9.fbx'
  ];

  const scale = 0.05;

  for (let i = 0; i < 20; i++) {
    const x = (Math.random() - 0.5) * 80;
    const z = (Math.random() - 0.5) * 80;
    const y = multiOctavePerlinNoise3D(x * scale, z * scale, 0) * 10;

    // Randomly choose between tree and rock models
    const models = Math.random() > 0.5 ? treeModels : rockModels;
    const modelPath = models[Math.floor(Math.random() * models.length)];

    loadFBXModel(modelPath, new THREE.Vector3(x, y, z), scene);
  }
}