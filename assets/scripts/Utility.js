// Utility.js
import * as THREE from 'three'; // Keep THREE import if any utility directly uses it beyond type hinting

/**
 * Generates a unique string key for a chunk based on its grid coordinates.
 * @param {number} chunkX - The X coordinate of the chunk in the grid.
 * @param {number} chunkZ - The Z coordinate of the chunk in the grid.
 * @returns {string} A string key representing the chunk's coordinates.
 */
export function getChunkKey(chunkX, chunkZ) {
    return `${chunkX},${chunkZ}`;
}

/**
 * Disposes of a Three.js material and its associated textures.
 * @param {THREE.Material | THREE.Material[]} material - The material or array of materials to dispose of.
 */
export function cleanMaterial(material) {
    if (!material) return;

    if (Array.isArray(material)) {
        material.forEach(mat => cleanSingleMaterial(mat));
    } else {
        cleanSingleMaterial(material);
    }
}

function cleanSingleMaterial(mat) {
    if (!mat) return;
    mat.dispose();

    // Dispose textures
    for (const key of Object.keys(mat)) {
        const value = mat[key];
        if (value && typeof value === 'object' && value.isTexture) {
            value.dispose();
        }
    }
}