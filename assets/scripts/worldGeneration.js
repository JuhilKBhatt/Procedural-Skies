// worldGeneration.js
import * as THREE from 'three';
import { generateCombinedTerrain } from './perlinNoise.js';
import { calculateVertexColor } from './worldColour.js';
import { populateChunk } from './worldPopulate.js'; // Changed from populateWorld
import * as CANNON from 'cannon-es';

export const CHUNK_SIZE = 100;
export const CHUNK_SEGMENTS = 50;
const TERRAIN_MAX_HEIGHT = 80;
const TERRAIN_MIN_HEIGHT = -40;
const NOISE_INPUT_SCALE = 0.007;

// Make generateTerrainChunk async if populateChunk becomes async
export async function generateTerrainChunk(chunkGridX, chunkGridZ, scene, world, terrainMaterial) {
    // ... (geometry, vertices, colors, heightData generation - no changes here) ...
    // ... (mesh material, terrainChunkMesh creation, scene.add(terrainChunkMesh) - no changes here) ...
    // ... (physics body creation, world.addBody(terrainChunkBody) - no changes here) ...

    const geometry = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, CHUNK_SEGMENTS, CHUNK_SEGMENTS);
    const vertices = geometry.attributes.position.array;
    const colors = [];
    const heightData = [];

    for (let i = 0; i <= CHUNK_SEGMENTS; i++) {
        heightData[i] = [];
        for (let j = 0; j <= CHUNK_SEGMENTS; j++) {
            const vertexIndex = (i * (CHUNK_SEGMENTS + 1) + j) * 3;
            const localX = vertices[vertexIndex];
            const localZ = vertices[vertexIndex + 1];
            const worldX = (chunkGridX * CHUNK_SIZE) + localX;
            const worldZ = (chunkGridZ * CHUNK_SIZE) + localZ;

            const normalizedHeight = generateCombinedTerrain(
                worldX * NOISE_INPUT_SCALE,
                worldZ * NOISE_INPUT_SCALE,0);
            const actualHeight = TERRAIN_MIN_HEIGHT + normalizedHeight * (TERRAIN_MAX_HEIGHT - TERRAIN_MIN_HEIGHT);

            vertices[vertexIndex + 2] = actualHeight;
            heightData[i][j] = actualHeight;

            const { r, g, b } = calculateVertexColor(normalizedHeight);
            colors.push(r, g, b);
        }
    }

    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals();

    const material = new THREE.MeshPhongMaterial({
        vertexColors: true,
        shininess: 5,
    });

    const terrainChunkMesh = new THREE.Mesh(geometry, material);
    terrainChunkMesh.rotation.x = -Math.PI / 2;
    terrainChunkMesh.position.set(chunkGridX * CHUNK_SIZE, 0, chunkGridZ * CHUNK_SIZE);
    terrainChunkMesh.castShadow = true;
    terrainChunkMesh.receiveShadow = true;
    scene.add(terrainChunkMesh);

    const heightfieldShape = new CANNON.Heightfield(heightData, {
        elementSize: CHUNK_SIZE / CHUNK_SEGMENTS
    });
    const terrainChunkBody = new CANNON.Body({ mass: 0, material: terrainMaterial });
    terrainChunkBody.addShape(heightfieldShape);
    terrainChunkBody.position.set(
        chunkGridX * CHUNK_SIZE - CHUNK_SIZE / 2,
        0,
        chunkGridZ * CHUNK_SIZE - CHUNK_SIZE / 2
    );
    terrainChunkBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    world.addBody(terrainChunkBody);

    // Call populateChunk and store the results
    // If populateChunk is async, you MUST await it here.
    // And this function (generateTerrainChunk) must also be declared async.
    let populatedObjects = [];
    try {
        // Assuming populateChunk is now async due to awaiting loadFBXModel
        populatedObjects = await populateChunk(scene, terrainChunkMesh, chunkGridX, chunkGridZ);
    } catch (error) {
        console.error(`Error populating chunk ${chunkGridX}, ${chunkGridZ}:`, error);
    }


    return {
        mesh: terrainChunkMesh,
        body: terrainChunkBody,
        chunkGridX: chunkGridX,
        chunkGridZ: chunkGridZ,
        populatedObjects: populatedObjects // Store the array of added decorative objects
    };
}