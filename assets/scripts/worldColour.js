import * as THREE from 'three';
import { getSimilarColour, lerpColor } from './Utility.js';

/**
 * Linearly interpolates between two colors.
 * @param {THREE.Color} color1 - The first color.
 * @param {THREE.Color} color2 - The second color.
 * @param {number} t - Interpolation factor (0 to 1).
 * @returns {THREE.Color} - The interpolated color.
 */

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
    if (height < 3) {
        const t = THREE.MathUtils.clamp(height / 3, 0, 1);
        baseColor = lerpColor(waterColor, beachColor, t);
    } else if (height < 3) {
        const t = THREE.MathUtils.clamp((height - 0) / 3, 0, 1);
        baseColor = lerpColor(beachColor, grassLowColor, t);
    } else if (height < 8) {
        const t = THREE.MathUtils.clamp((height - 3) / 5, 0, 1);
        baseColor = lerpColor(grassLowColor, grassHighColor, t);
    } else if (height < 10) {
        const t = THREE.MathUtils.clamp((height - 8) / 2, 0, 1);
        baseColor = lerpColor(grassHighColor, rockColor, t);
    } else {
        const t = THREE.MathUtils.clamp((height - 10) / 4, 0, 1);
        baseColor = lerpColor(rockColor, snowColor, t);
    }

    // Add a slight random variation to the base color
    const variedColor = new THREE.Color(getSimilarColour(baseColor.getHex(), 0.005));

    colors.push(variedColor.r, variedColor.g, variedColor.b);
  }

  // Add the colors as a new attribute to the geometry
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
}