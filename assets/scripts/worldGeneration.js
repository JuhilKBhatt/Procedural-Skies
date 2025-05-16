// worldGeneration.js
import * as THREE from 'three';
import { multiOctavePerlinNoise3D } from './perlinNoise.js';
import { loadFBXModel } from './LoadFBXModel.js';

export function generateTerrain(scene) {
  const geometry = new THREE.PlaneGeometry(100, 100, 100, 100);
  const scale = 0.05;

  for (let i = 0; i < geometry.attributes.position.count; i++) {
    const x = geometry.attributes.position.getX(i) * scale;
    const y = geometry.attributes.position.getY(i) * scale;
    const z = multiOctavePerlinNoise3D(x, y, 0, 8, 0.5, 2.0) * 10;
    geometry.attributes.position.setZ(i, z);
  }
  geometry.computeVertexNormals();
  geometry.rotateX(-Math.PI / 2);

  const material = new THREE.MeshStandardMaterial({ color: 0x228B22, wireframe: true});
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  // Load tree and rock models at random positions on the terrain
  const treeModels = ['assets/models/tree/TreePine.fbx', 'assets/models/tree/TreeRound.fbx'];
  const rockModels = [
    'assets/models/rock/Rock1.fbx', 'assets/models/rock/Rock2.fbx', 'assets/models/rock/Rock3.fbx',
    'assets/models/rock/Rock4.fbx', 'assets/models/rock/Rock5.fbx', 'assets/models/rock/Rock6.fbx',
    'assets/models/rock/Rock7.fbx', 'assets/models/rock/Rock8.fbx', 'assets/models/rock/Rock9.fbx'
  ];

  for (let i = 0; i < 20; i++) {
    const x = (Math.random() - 0.5) * 80;
    const y = (Math.random() - 0.5) * 80;
    const z = multiOctavePerlinNoise3D(x * scale, y * scale, 0) * 10;
    const modelPath = Math.random() > 0.5 ? treeModels[Math.floor(Math.random() * treeModels.length)] : rockModels[Math.floor(Math.random() * rockModels.length)];
    loadFBXModel(modelPath, new THREE.Vector3(x, z, y), scene); // Corrected to use XZ for placement
  }

  return mesh;
}