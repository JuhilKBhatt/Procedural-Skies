import * as THREE from 'three';
import { multiOctavePerlinNoise3D } from './perlinNoise.js';
import { populateWorld } from './worldPopulate.js';
import { colorTerrain } from './worldColour.js';

export function generateTerrain(scene) {
  const geometry = new THREE.PlaneGeometry(100, 100, 100, 100);
  const scale = 0.05;

  // Generate terrain height
  for (let i = 0; i < geometry.attributes.position.count; i++) {
    const x = geometry.attributes.position.getX(i) * scale;
    const y = geometry.attributes.position.getY(i) * scale;
    const z = multiOctavePerlinNoise3D(x, y, 2, 8, 0.1, 1.5) * 15;
    geometry.attributes.position.setZ(i, z);
  }
  geometry.computeVertexNormals();
  geometry.rotateX(-Math.PI / 2);

  // Apply colors to the terrain
  colorTerrain(geometry);

  // Use vertex colors in the material
  const material = new THREE.MeshStandardMaterial({ vertexColors: true });
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  // Populate the world with trees and rocks, passing the terrain mesh
  populateWorld(scene, mesh);

  return mesh;
}