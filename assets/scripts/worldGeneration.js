// worldGeneration.js
import * as THREE from 'three';
import { multiOctavePerlinNoise3D } from './perlinNoise.js';
import { populateWorld } from './worldPopulate.js';

export function generateTerrain(scene) {
  const geometry = new THREE.PlaneGeometry(100, 100, 100, 100);
  const scale = 0.05;

  // Generate terrain height
  for (let i = 0; i < geometry.attributes.position.count; i++) {
    const x = geometry.attributes.position.getX(i) * scale;
    const y = geometry.attributes.position.getY(i) * scale;
    const z = multiOctavePerlinNoise3D(x, y, 0, 8, 0.5, 2.0) * 10;
    geometry.attributes.position.setZ(i, z);
  }
  geometry.computeVertexNormals();
  geometry.rotateX(-Math.PI / 2);

  const material = new THREE.MeshStandardMaterial({ color: 0x228B22 });
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  // Populate the world with trees and rocks, passing the terrain mesh
  populateWorld(scene, mesh);

  return mesh;
}