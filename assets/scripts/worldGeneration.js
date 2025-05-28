// assets/scripts/worldGeneration.js
import * as THREE from 'three';
import { generateCombinedTerrain } from './perlinNoise.js';
import { calculateVertexColor } from './worldColour.js';
import { populateChunk } from './worldPopulate.js';
import * as CANNON from 'cannon-es';

export const CHUNK_SIZE = 200; // Can be made dynamic if needed, but kept const for now
export const CHUNK_SEGMENTS = 60; // Can be made dynamic if needed

// TERRAIN_MAX_HEIGHT, TERRAIN_MIN_HEIGHT, NOISE_INPUT_SCALE are now passed via worldGenSettings

export async function generateTerrainChunk(
    chunkGridX,
    chunkGridZ,
    scene,
    world,
    terrainMaterial,
    worldGenSettings,  // Added parameter
    worldPopSettings   // Added parameter (to pass to populateChunk)
) {
    const { TERRAIN_MAX_HEIGHT, TERRAIN_MIN_HEIGHT, NOISE_INPUT_SCALE } = worldGenSettings;

    const geometry = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, CHUNK_SEGMENTS, CHUNK_SEGMENTS);
    const vertices = geometry.attributes.position.array;
    const colors = [];
    const heightData = [];

    for (let i = 0; i <= CHUNK_SEGMENTS; i++) {
        heightData[i] = [];
        for (let j = 0; j <= CHUNK_SEGMENTS; j++) {
            const vertexIndex = (i * (CHUNK_SEGMENTS + 1) + j) * 3;
            const localX_geom = vertices[vertexIndex];
            const localY_geom = vertices[vertexIndex + 1];

            const worldX_noise = (chunkGridX * CHUNK_SIZE) + localX_geom;
            const worldZ_noise = (chunkGridZ * -CHUNK_SIZE) + localY_geom;

            const normalizedHeight = generateCombinedTerrain(
                worldX_noise * NOISE_INPUT_SCALE, // Use from settings
                worldZ_noise * NOISE_INPUT_SCALE, // Use from settings
                0
            );
            const actualHeight = TERRAIN_MIN_HEIGHT + normalizedHeight * (TERRAIN_MAX_HEIGHT - TERRAIN_MIN_HEIGHT); // Use from settings

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
        shininess: 10
    });

    const terrainChunkMesh = new THREE.Mesh(geometry, material);
    terrainChunkMesh.rotation.x = -Math.PI / 2;
    terrainChunkMesh.position.set(chunkGridX * CHUNK_SIZE, 0, chunkGridZ * CHUNK_SIZE);
    terrainChunkMesh.castShadow = true;
    terrainChunkMesh.receiveShadow = true;
    scene.add(terrainChunkMesh);

    const planeShape = new CANNON.Plane();
    const terrainChunkBody = new CANNON.Body({ mass: 0, material: terrainMaterial });
    terrainChunkBody.addShape(planeShape);
    terrainChunkBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    // Adjust physics plane Y based on TERRAIN_MIN_HEIGHT if it can go very low,
    // or ensure it's slightly below the lowest possible visual terrain point.
    // For simplicity, keeping it at a fixed low value, assuming MIN_HEIGHT won't make terrain go below this significantly.
    terrainChunkBody.position.set(0, Math.min(-1, TERRAIN_MIN_HEIGHT - 10) , 0); // Ensure physics plane is below min terrain height
    world.addBody(terrainChunkBody);

    let populatedObjects = [];
    try {
        // Pass worldGenSettings for TERRAIN_MAX_HEIGHT needed by populateChunk for cloud placement, and worldPopSettings
        populatedObjects = await populateChunk(
            scene,
            terrainChunkMesh,
            chunkGridX,
            chunkGridZ,
            heightData,
            worldGenSettings, // Pass through
            worldPopSettings, // Pass through
            CHUNK_SIZE,       // Pass const CHUNK_SIZE
            CHUNK_SEGMENTS    // Pass const CHUNK_SEGMENTS
        );
    } catch (error) {
        console.error(`Error populating chunk ${chunkGridX}, ${chunkGridZ}:`, error);
    }

    return {
        mesh: terrainChunkMesh,
        body: terrainChunkBody,
        chunkGridX: chunkGridX,
        chunkGridZ: chunkGridZ,
        populatedObjects: populatedObjects,
        // Storing heightData might be useful for true repopulation later
        // heightData: heightData
    };
}