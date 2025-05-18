// worldGeneration.js
import * as THREE from 'three';
import { generateCombinedTerrain } from './perlinNoise.js';
import { calculateVertexColor } from './worldColour.js';

export function generateTerrain() { // Removed 'scene' argument as it's not used
    const terrainSize = 500; // Width and depth of the terrain plane
    const terrainSegments = 128; // Number of segments (resolution WxH) - higher means more detail
    const terrainMaxHeight = 50; // Maximum peak height of the terrain
    const terrainMinHeight = -15; // Minimum depth (e.g., for river beds or deep water)

    const geometry = new THREE.PlaneGeometry(terrainSize, terrainSize, terrainSegments, terrainSegments);
    const vertices = geometry.attributes.position.array;
    const colors = []; // Array to hold vertex colors

    const noiseInputScale = 0.015; // Scale for world coordinates before passing to noise function
                                  // Adjust this to change the "zoom" of the terrain features

    for (let i = 0; i < vertices.length; i += 3) {
        // vertices are [x1, y1, z1, x2, y2, z2, ...]
        // For PlaneGeometry, default is XY plane. We will use x for width, y for depth (of the plane).
        // The actual height (our visual Z in the world after rotation) will be applied to vertices[i+2].
        const worldX = vertices[i];
        const worldY = vertices[i + 1];

        // Calculate normalized height (0 to 1) using Perlin noise combination
        // The z-coordinate for noise input can be 0 if we want a 2D slice of 3D noise.
        const normalizedHeight = generateCombinedTerrain(worldX * noiseInputScale, worldY * noiseInputScale, 0);

        // Apply actual height: map normalizedHeight (0-1) to the desired range [terrainMinHeight, terrainMaxHeight]
        const actualHeight = terrainMinHeight + normalizedHeight * (terrainMaxHeight - terrainMinHeight);
        vertices[i + 2] = actualHeight; // Update the z-coordinate (which becomes Y after rotation)

        // Determine vertex color based on normalized height using the function from worldColour.js
        const { r, g, b } = calculateVertexColor(normalizedHeight);
        colors.push(r, g, b);
    }

    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.attributes.position.needsUpdate = true; // Signal that vertices have been changed
    geometry.computeVertexNormals(); // Crucial for correct lighting

    const material = new THREE.MeshPhongMaterial({
        vertexColors: true, // Enable vertex colors
        shininess: 5,       // Lower shininess for more diffuse terrain
        // side: THREE.DoubleSide, // Useful for debugging or if camera can go below terrain
    });

    const terrainMesh = new THREE.Mesh(geometry, material);

    // Rotate the plane to be horizontal (XZ plane in world space)
    // PlaneGeometry is created in the XY plane. Rotating -90 degrees around X makes Y axis point up.
    terrainMesh.rotation.x = -Math.PI / 2;
    // terrainMesh.position.y = 0; // Adjust if necessary, but plane is centered at origin by default.
                                 // After rotation, its center is (0,0,0). Heights are relative to this.

    // Enable shadows for the terrain
    terrainMesh.castShadow = true;
    terrainMesh.receiveShadow = true;

    return terrainMesh;
}