import * as THREE from 'three';
import { getSimilarColour } from './Utility.js';

/**
 * Linearly interpolates between two colors.
 * @param {THREE.Color} color1 - The first color.
 * @param {THREE.Color} color2 - The second color.
 * @param {number} t - Interpolation factor (0 to 1).
 * @returns {THREE.Color} - The interpolated color.
 */
function lerpColor(color1, color2, t) {
  return color1.clone().lerp(color2, t);
}

/**
 * Applies smooth blended colors to the terrain based on height with variation.
 * @param {THREE.Geometry} geometry - The geometry of the terrain.
 */
export function colorTerrain(geometry) {
  const colors = [];
  const position = geometry.attributes.position;

  // Define gradient stops for better blending
  const waterColor = new THREE.Color(0x1e3d59);   // Deep Blue
  const beachColor = new THREE.Color(0xc2b280);   // Sand
  const grassLowColor = new THREE.Color(0x2e8b57); // Dark Green (Low altitude)
  const grassHighColor = new THREE.Color(0x3cb371); // Light Green (High altitude)
  const rockColor = new THREE.Color(0x808080);    // Gray
  const snowColor = new THREE.Color(0xffffff);    // White

  for (let i = 0; i < position.count; i++) {
    // Since the geometry is rotated, height is stored in the Y position
    const height = position.getY(i);

    let baseColor;

    // Smoothly blend between different terrain types
    if (height < 5) {
      // Water to Beach (Smooth transition)
      const t = Math.max(0, height / 3);
      baseColor = lerpColor(waterColor, beachColor, t);
    } else if (height < 7) {
      // Beach to Low Grass
      const t = (height - 3);
      baseColor = lerpColor(beachColor, grassLowColor, t);
    } else if (height < 7) {
      // Low Grass to High Grass
      const t = (height - 4) / 2;
      baseColor = lerpColor(grassLowColor, grassHighColor, t);
    } else if (height < 7) {
      // High Grass to Rock
      const t = (height - 6) / 2;
      baseColor = lerpColor(grassHighColor, rockColor, t);
    } else {
      // Rock to Snow
      const t = Math.min((height - 8) / 4, 1);
      baseColor = lerpColor(rockColor, snowColor, t);
    }

    // Add a slight random variation to the base color
    const variedColor = new THREE.Color(getSimilarColour(baseColor.getHex(), 0.02));

    colors.push(variedColor.r, variedColor.g, variedColor.b);
  }

  // Add the colors as a new attribute to the geometry
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
}