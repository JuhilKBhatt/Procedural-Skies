// worldgeneration.js
import * as THREE from 'three';
import { multiOctavePerlinNoise3D } from './perlinnoise.js';

export function generateTerrain() {
  const geometry = new THREE.PlaneGeometry(1000, 1000, 1000, 1000);
  const scale = 0.05; // Adjust for finer or coarser terrain

  for (let i = 0; i < geometry.attributes.position.count; i++) {
    const x = geometry.attributes.position.getX(i) * scale;
    const y = geometry.attributes.position.getY(i) * scale;
    const z = multiOctavePerlinNoise3D(x, y, 0, 8, 0.5, 2.0) * 10;
    geometry.attributes.position.setZ(i, z);
  }
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({ color: 0x228B22 });
  const mesh = new THREE.Mesh(geometry, material);

  return mesh;
}