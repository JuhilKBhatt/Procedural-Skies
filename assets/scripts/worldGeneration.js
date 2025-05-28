// assets/scripts/worldGeneration.js
import * as THREE from 'three';
import { generateCombinedTerrain } from './perlinNoise.js';
import { calculateVertexColor } from './worldColour.js';
import { populateChunk } from './worldPopulate.js';
import * as CANNON from 'cannon-es';

export const CHUNK_SIZE = 200;
export const CHUNK_SEGMENTS = 60;

export async function generateTerrainChunk(
    chunkGridX,
    chunkGridZ,
    scene,
    world,
    terrainMaterial,
    worldGenSettings,
    worldPopSettings
) {
    const { TERRAIN_MAX_HEIGHT, TERRAIN_MIN_HEIGHT, NOISE_INPUT_SCALE } = worldGenSettings;

    const geometry = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, CHUNK_SEGMENTS, CHUNK_SEGMENTS);
    const vertices = geometry.attributes.position.array;
    const colors = [];
    const heightData = [];

    // Initialise heightData as a 2D array for storing heights
    for (let i = 0; i <= CHUNK_SEGMENTS; i++) {
        heightData[i] = [];
        for (let j = 0; j <= CHUNK_SEGMENTS; j++) {
            const vertexIndex = (i * (CHUNK_SEGMENTS + 1) + j) * 3;
            const localX_geom = vertices[vertexIndex];
            const localY_geom = vertices[vertexIndex + 1];

            const worldX_noise = (chunkGridX * CHUNK_SIZE) + localX_geom;
            const worldZ_noise = (chunkGridZ * -CHUNK_SIZE) + localY_geom;

            const normalizedHeight = generateCombinedTerrain(
                worldX_noise * NOISE_INPUT_SCALE,
                worldZ_noise * NOISE_INPUT_SCALE,
                0
            );
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
    terrainChunkBody.position.set(0, Math.min(-1, TERRAIN_MIN_HEIGHT - 10) , 0);
    world.addBody(terrainChunkBody);

    let populatedObjects = [];
    try {
        populatedObjects = await populateChunk(
            scene,
            terrainChunkMesh,
            chunkGridX,
            chunkGridZ,
            heightData,
            worldGenSettings,
            worldPopSettings,
            CHUNK_SIZE,
            CHUNK_SEGMENTS
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
    };
}