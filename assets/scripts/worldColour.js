import * as THREE from 'three';

/**
 * Applies color to the terrain based on height.
 * @param {THREE.Geometry} geometry - The geometry of the terrain.
 */
export function colorTerrain(geometry) {
  const colors = [];
  const position = geometry.attributes.position;

  for (let i = 0; i < position.count; i++) {
    // Since the geometry is rotated, height is stored in the Y position
    const height = position.getY(i);

    let color;
    if (height < 4) {
      // Water (deep blue)
      color = new THREE.Color(0x1e3d59);
    } else if (height < 5) {
      // Beach (sand)
      color = new THREE.Color(0xc2b280);
    } else if (height < 7) {
      // Grassland (green)
      color = new THREE.Color(0x228B22);
    } else {
      // Snowy peaks (white)
      color = new THREE.Color(0xffffff);
    }

    colors.push(color.r, color.g, color.b);
  }

  // Add the colors as a new attribute to the geometry
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
}