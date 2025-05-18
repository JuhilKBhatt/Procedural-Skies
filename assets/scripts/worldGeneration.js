import * as THREE from 'three';
import { generateCombinedTerrain } from './perlinNoise.js'; // Import the new combined terrain function
import { populateWorld } from './worldPopulate.js';
import { colorTerrain } from './worldColour.js';

export function generateTerrain(scene) {
  const geometry = new THREE.PlaneGeometry(200, 200, 200, 200);
  const scale = 0.05;
  const heightMultiplier = 15;
  const zOffset = 10;

  // Generate terrain height using the combined noise function
  const positionAttribute = geometry.attributes.position;
  for (let i = 0; i < positionAttribute.count; i++) {
    const x = positionAttribute.getX(i) * scale;
    const y = positionAttribute.getY(i) * scale;

    // Use the combined terrain function for varied height
    let z = generateCombinedTerrain(x, y, zOffset) * heightMultiplier;
    positionAttribute.setZ(i, z);
  }

  // Mark the position attribute as needing an update
  positionAttribute.needsUpdate = true;

  // Recalculate bounding sphere and box after changing vertices
  geometry.computeBoundingSphere();
  geometry.computeBoundingBox();

  geometry.computeVertexNormals();
  geometry.rotateX(-Math.PI / 2); // Rotate the plane to be horizontal

  colorTerrain(geometry);

  // Use vertex colors in the material
  const material = new THREE.MeshStandardMaterial({ vertexColors: true });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(0, 0, 0);

  scene.add(mesh);

  // Populate the world with trees and rocks, passing the terrain mesh
  // populateWorld(scene, mesh);

  return mesh;
}