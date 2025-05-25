// worldColour.js
import * as THREE from 'three';

// Define colors for different elevation levels
export const colorWaterDeep = new THREE.Color(0x003366);   // Dark Blue
export const colorWaterShallow = new THREE.Color(0x007bff); // Light Blue
export const colorSand = new THREE.Color(0x349117);      // Green
export const colorGrass = new THREE.Color(0x228b22);      // Forest Green
export const colorDirt = new THREE.Color(0x8b4513);        // Saddle Brown / Dirt
export const colorRock = new THREE.Color(0x808080);        // Gray
export const colorSnow = new THREE.Color(0xfffafa);        // Snow White

// Define normalized height thresholds for different terrain types/colors
// These thresholds are for the noise value that comes from generateCombinedTerrain (0 to 1)
export const normalizedWaterLevel = 0.30;
export const normalizedSandLevel = 0.35;
export const normalizedGrassLevel = 0.50;
export const normalizedRockLevel = 0.70;
// Snow will be above rock level

export function calculateVertexColor(normalizedHeight) {
    let r, g, b;
    if (normalizedHeight < normalizedWaterLevel) {
        const factor = normalizedHeight / normalizedWaterLevel; // 0 to 1
        const waterColor = new THREE.Color().lerpColors(colorWaterDeep, colorWaterShallow, factor);
        r = waterColor.r; g = waterColor.g; b = waterColor.b;
    } else if (normalizedHeight < normalizedSandLevel) {
        const factor = (normalizedHeight - normalizedWaterLevel) / (normalizedSandLevel - normalizedWaterLevel);
        const sandColor = new THREE.Color().lerpColors(colorWaterShallow, colorSand, factor); // Smooth transition from shallow water
        r = sandColor.r; g = sandColor.g; b = sandColor.b;
    } else if (normalizedHeight < normalizedGrassLevel) {
        const factor = (normalizedHeight - normalizedSandLevel) / (normalizedGrassLevel - normalizedSandLevel);
        const grassColor = new THREE.Color().lerpColors(colorSand, colorGrass, factor);
        r = grassColor.r; g = grassColor.g; b = grassColor.b;
    } else if (normalizedHeight < normalizedRockLevel) {
        const factor = (normalizedHeight - normalizedGrassLevel) / (normalizedRockLevel - normalizedGrassLevel);
        // For a more complex Grass -> Dirt -> Rock:
        if (factor < 0.5) { // Grass to Dirt
            const dirtColor = new THREE.Color().lerpColors(colorGrass, colorDirt, factor * 2);
             r = dirtColor.r; g = dirtColor.g; b = dirtColor.b;
        } else { // Dirt to Rock
            const rockColorActual = new THREE.Color().lerpColors(colorDirt, colorRock, (factor - 0.5) * 2);
             r = rockColorActual.r; g = rockColorActual.g; b = rockColorActual.b;
        }
    } else { // Rock to Snow
        const factor = (normalizedHeight - normalizedRockLevel) / (1.0 - normalizedRockLevel); // Ensure factor is 0-1 for this range
        const snowColor = new THREE.Color().lerpColors(colorRock, colorSnow, Math.min(factor,1)); // Clamp factor to avoid issues if normalizedHeight > 1
        r = snowColor.r; g = snowColor.g; b = snowColor.b;
    }
    return { r, g, b };
}