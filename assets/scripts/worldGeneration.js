// worldgeneration.js
import * as THREE from 'three';
import { perlin } from './perlinNoise.js';

export function generateTerrain() {
  const geometry = new THREE.PlaneGeometry(100, 100, 100, 100);
  for (let i = 0; i < geometry.attributes.position.count; i++) {
    const x = geometry.attributes.position.getX(i);
    const y = geometry.attributes.position.getY(i);
    const z = perlin(x, y, 0) * 5;
    geometry.attributes.position.setZ(i, z);
  }
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({ color: 0x228B22, wireframe: false });
  const mesh = new THREE.Mesh(geometry, material);

  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(50, 50, 100);
  mesh.add(light);

  return mesh;
}