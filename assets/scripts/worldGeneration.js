// worldGeneration.js
import * as THREE from 'three';
import { generateCombinedTerrain } from './perlinNoise.js';
import { calculateVertexColor } from './worldColour.js';
import { populateChunk } from './worldPopulate.js';
import * as CANNON from 'cannon-es';

export const CHUNK_SIZE = 200;
export const CHUNK_SEGMENTS = 60;
export const TERRAIN_MAX_HEIGHT = 80;
const TERRAIN_MIN_HEIGHT = -40;
const NOISE_INPUT_SCALE = 0.007;

export async function generateTerrainChunk(chunkGridX, chunkGridZ, scene, world, terrainMaterial) {
    const geometry = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, CHUNK_SEGMENTS, CHUNK_SEGMENTS);
    const vertices = geometry.attributes.position.array;
    const colors = [];
    const heightData = []; // This will be passed to populateChunk

    for (let i = 0; i <= CHUNK_SEGMENTS; i++) { // Corresponds to Z-like segments for heightData
        heightData[i] = [];
        for (let j = 0; j <= CHUNK_SEGMENTS; j++) { // Corresponds to X-like segments for heightData
            const vertexIndex = (i * (CHUNK_SEGMENTS + 1) + j) * 3;
            // In PlaneGeometry:
            // vertices[vertexIndex] is local X
            // vertices[vertexIndex+1] is local Y (which becomes local Z for noise, and world Z after mesh rotation)
            const localX_geom = vertices[vertexIndex];
            const localY_geom = vertices[vertexIndex + 1]; // This is the plane's "height" direction

            // World coordinates for noise generation
            const worldX_noise = (chunkGridX * CHUNK_SIZE) + localX_geom;
            const worldZ_noise = (chunkGridZ * -CHUNK_SIZE) + localY_geom; // Use localY_geom for Z noise input

            const normalizedHeight = generateCombinedTerrain(
                worldX_noise * NOISE_INPUT_SCALE,
                worldZ_noise * NOISE_INPUT_SCALE, 0);
            const actualHeight = TERRAIN_MIN_HEIGHT + normalizedHeight * (TERRAIN_MAX_HEIGHT - TERRAIN_MIN_HEIGHT);

            vertices[vertexIndex + 2] = actualHeight; // Set the Z component of the vertex (which is Y in world space)
            
            // Store height for physics and potentially for object placement
            // heightData[i][j] -> heightData[z_idx][x_idx] convention matching CANNON.Heightfield
            // where i ~ z_idx, j ~ x_idx
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

    // Create a flat plane collider at Y=0
    const planeShape = new CANNON.Plane();
    const terrainChunkBody = new CANNON.Body({ mass: 0, material: terrainMaterial });
    terrainChunkBody.addShape(planeShape);
    terrainChunkBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0); // Rotate around X by -90 degrees
    terrainChunkBody.position.set(0, -50, 0);
    world.addBody(terrainChunkBody);

    let populatedObjects = [];
    try {
        // Pass heightData to populateChunk (still useful for object placement on the visual terrain)
        populatedObjects = await populateChunk(scene, terrainChunkMesh, chunkGridX, chunkGridZ, heightData);
    } catch (error) {
        console.error(`Error populating chunk ${chunkGridX}, ${chunkGridZ}:`, error);
    }

    return {
        mesh: terrainChunkMesh,
        body: terrainChunkBody,
        chunkGridX: chunkGridX,
        chunkGridZ: chunkGridZ,
        populatedObjects: populatedObjects
    };
}