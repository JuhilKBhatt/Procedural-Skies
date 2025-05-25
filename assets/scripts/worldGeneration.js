// worldGeneration.js
import * as THREE from 'three';
import { generateCombinedTerrain } from './perlinNoise.js';
import { calculateVertexColor } from './worldColour.js';
// import { populateWorld } from './worldPopulate.js'; // If you re-introduce this, it needs to be chunk-aware
import * as CANNON from 'cannon-es';

export const CHUNK_SIZE = 200; // Width and depth of a terrain chunk
export const CHUNK_SEGMENTS = 50; // Number of segments per chunk side (resolution)
const TERRAIN_MAX_HEIGHT = 100;
const TERRAIN_MIN_HEIGHT = -50;
const NOISE_INPUT_SCALE = 0.004; // Adjust for terrain feature scaling

export function generateTerrainChunk(chunkGridX, chunkGridZ, scene, world, terrainMaterial) {
    const geometry = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, CHUNK_SEGMENTS, CHUNK_SEGMENTS);
    const vertices = geometry.attributes.position.array;
    const colors = [];
    const heightData = []; // For Cannon.js Heightfield

    for (let i = 0; i <= CHUNK_SEGMENTS; i++) { // Note: CHUNK_SEGMENTS+1 vertices along each edge
        heightData[i] = [];
        for (let j = 0; j <= CHUNK_SEGMENTS; j++) {
            const vertexIndex = (i * (CHUNK_SEGMENTS + 1) + j) * 3;

            // Calculate local vertex positions within the chunk
            const localX = vertices[vertexIndex];     // Ranges from -CHUNK_SIZE/2 to CHUNK_SIZE/2
            const localZ = vertices[vertexIndex + 1]; // Correct: PlaneGeometry y becomes world Z

            // Calculate world coordinates for noise sampling
            // The origin of the PlaneGeometry is at its center.
            // chunkGridX/Z are indices of the chunk.
            const worldX = (chunkGridX * CHUNK_SIZE) + localX;
            const worldZ = (chunkGridZ * CHUNK_SIZE) + localZ; // Mesh's Y is world's Z before rotation

            const normalizedHeight = generateCombinedTerrain(
                worldX * NOISE_INPUT_SCALE,
                worldZ * NOISE_INPUT_SCALE, // Use worldZ for the 2D noise input
                0 // Assuming z in noise3D is not heavily used for 2.5D terrain
            );
            const actualHeight = TERRAIN_MIN_HEIGHT + normalizedHeight * (TERRAIN_MAX_HEIGHT - TERRAIN_MIN_HEIGHT);

            vertices[vertexIndex + 2] = actualHeight; // Set Z for PlaneGeometry (becomes Y after rotation)
            heightData[i][j] = actualHeight;

            const { r, g, b } = calculateVertexColor(normalizedHeight);
            colors.push(r, g, b);
        }
    }
    // Cannon Heightfield expects data rows to be along its x-axis and columns along its z-axis.
    // Our PlaneGeometry vertices are ordered by row then column.
    // If plane rotated -PI/2 around X: plane's X -> world X, plane's Y -> world Z, plane's Z -> world Y
    // Height data needs to be ordered consistent with how Cannon.js Heightfield interprets it.
    // With rotation x = -Math.PI / 2:
    // Heightfield X corresponds to Plane's X.
    // Heightfield Z corresponds to Plane's Y.
    // The way heightData is populated (outer loop i for Z-like, inner loop j for X-like on the plane)
    // might need reversing for Cannon.js depending on its convention if issues arise.
    // For now, assuming this order matches Cannon's expectation after the body's rotation.


    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals();

    const material = new THREE.MeshPhongMaterial({
        vertexColors: true,
        shininess: 5,
        // wireframe: true, // For debugging chunk boundaries
    });

    const terrainChunkMesh = new THREE.Mesh(geometry, material);
    terrainChunkMesh.rotation.x = -Math.PI / 2; // Rotate the plane to be horizontal

    // Position the chunk in the world
    // The PlaneGeometry vertices are relative to its center, so the mesh itself is placed at the chunk's origin.
    terrainChunkMesh.position.set(
        chunkGridX * CHUNK_SIZE,
        0, // Base Y position (heights are relative to this)
        chunkGridZ * CHUNK_SIZE
    );

    terrainChunkMesh.castShadow = true;
    terrainChunkMesh.receiveShadow = true;
    scene.add(terrainChunkMesh);

    // --- Physics Body for the Chunk ---
    const heightfieldShape = new CANNON.Heightfield(heightData, {
        elementSize: CHUNK_SIZE / CHUNK_SEGMENTS // Distance between data points
    });

    const terrainChunkBody = new CANNON.Body({
        mass: 0, // Static
        material: terrainMaterial
    });
    terrainChunkBody.addShape(heightfieldShape);

    // Position and rotate the physics body to match the visual mesh
    // The Heightfield's local origin is at its first data point.
    // We need to offset it so its center aligns with the PlaneGeometry's center.
    terrainChunkBody.position.set(
        (chunkGridX - 0.5) * CHUNK_SIZE, // Offset by -CHUNK_SIZE/2 in X
        0,                               // Base Y position
        (chunkGridZ - 0.5) * CHUNK_SIZE  // Offset by -CHUNK_SIZE/2 in Z
    );
    // Rotate the heightfield to be flat (Cannon.js Heightfield is y-up by default)
    // No, Heightfield assumes Y is height. The shape itself needs to be aligned.
    // The heights are directly used. Rotation of body aligns it.
    terrainChunkBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0); // Match visual mesh rotation


    // Adjust position due to Heightfield anchor point vs PlaneGeometry anchor point
    // PlaneGeometry origin is center. Heightfield origin is corner.
    // The shape is defined in its local space. The body's position is its world position.
    // The offset for the Heightfield within its local frame to align with the mesh's center:
    const shapeOffset = new CANNON.Vec3(CHUNK_SIZE / 2, 0, CHUNK_SIZE / 2);
    // We need to rotate this offset according to the body's quaternion before adding it.
    // However, simpler to adjust the body's position directly.
    // The provided `heightData` starts from what corresponds to one corner of the chunk.
    // The `terrainChunkBody.position` should be the world coordinates of that corner.
    terrainChunkBody.position.set(
        chunkGridX * CHUNK_SIZE - CHUNK_SIZE / 2,
        0, // This Y is critical, it's the base height level of the physics terrain.
           // The values in heightData are relative to this.
        chunkGridZ * CHUNK_SIZE - CHUNK_SIZE / 2
    );
    // The shape itself needs to be rotated if its "up" isn't Y.
    // But Heightfield expects heights along Y. So the body's quaternion handles orientation.

    world.addBody(terrainChunkBody);

    // If you had populateWorld, you'd call it here, passing chunk-specific info
    // populateWorld(scene, terrainChunkMesh, chunkGridX, chunkGridZ);

    return {
        mesh: terrainChunkMesh,
        body: terrainChunkBody,
        chunkGridX: chunkGridX,
        chunkGridZ: chunkGridZ
    };
}