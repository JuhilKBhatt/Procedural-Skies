// worldGeneration.js
import * as THREE from 'three';
import { generateCombinedTerrain } from './perlinNoise.js';
import { calculateVertexColor } from './worldColour.js';
import { populateWorld } from './worldPopulate.js';
import * as CANNON from 'cannon-es';

export function generateTerrain(scene, world, terrainMaterial) { // Added 'terrainMaterial' argument
    const terrainSize = 1000; // Width and depth of the terrain plane
    const terrainSegments = 100; // Number of segments
    const terrainMaxHeight = 100; // Maximum peak height of the terrain
    const terrainMinHeight = -50; // Minimum depth

    const geometry = new THREE.PlaneGeometry(terrainSize, terrainSize, terrainSegments, terrainSegments);
    const vertices = geometry.attributes.position.array;
    const colors = []; // Array to hold vertex colors

    const noiseInputScale = 0.002; // Scale for world coordinates before passing to noise function

    for (let i = 0; i < vertices.length; i += 3) {
        // vertices are [x1, y1, z1, x2, y2, z2, ...]
        const worldX = vertices[i];
        const worldY = vertices[i + 1];

        // Calculate normalized height (0 to 1) using Perlin noise combination
        const normalizedHeight = generateCombinedTerrain(worldX * noiseInputScale, worldY * noiseInputScale, 0);
        const actualHeight = terrainMinHeight + normalizedHeight * (terrainMaxHeight - terrainMinHeight);
        vertices[i + 2] = actualHeight;

        // Determine vertex color based on normalized height using the function from worldColour.js
        const { r, g, b } = calculateVertexColor(normalizedHeight);
        colors.push(r, g, b);
    }

    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals();

    const material = new THREE.MeshPhongMaterial({
        vertexColors: true,
        shininess: 5,
    });

    const terrainMesh = new THREE.Mesh(geometry, material);

    // Rotate the plane to be horizontal
    terrainMesh.rotation.x = -Math.PI / 2;
    terrainMesh.position.y = 0;

    // Enable shadows for the terrain
    terrainMesh.castShadow = true;
    terrainMesh.receiveShadow = true;

    scene.add(terrainMesh);
    //populateWorld(scene, terrainMesh);

    // --- START: MODIFICATION FOR FLAT PLANE COLLIDER ---
    const planeShape = new CANNON.Plane();
    const groundBody = new CANNON.Body({ mass: 0, material: terrainMaterial }); // Assign the terrain material
    groundBody.addShape(planeShape);
    groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0); // Rotate the plane to face upwards
    groundBody.position.set(0, 0, 0); // Set the Y level for the collider (adjust as needed)
    world.addBody(groundBody);
    // --- END: MODIFICATION FOR FLAT PLANE COLLIDER ---

    return terrainMesh; // Keep returning the Three.js mesh
}