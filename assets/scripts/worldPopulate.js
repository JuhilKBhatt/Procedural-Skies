// worldPopulate.js
import * as THREE from 'three';
import { loadFBXModel } from './LoadFBXModel.js';
// Import CHUNK_SEGMENTS along with CHUNK_SIZE and TERRAIN_MAX_HEIGHT
import { CHUNK_SIZE, TERRAIN_MAX_HEIGHT, CHUNK_SEGMENTS } from './worldGeneration.js';

const CLOUD_MODELS = [
    'assets/models/cloud/Cloud_1.fbx', 'assets/models/cloud/Cloud_2.fbx', 'assets/models/cloud/Cloud_3.fbx',
    'assets/models/cloud/Cloud_4.fbx'
];

const CLUSTERS_PER_CHUNK = 1;
const OBJECTS_PER_CLUSTER = 5;
const CLUSTER_RADIUS_MAX = 10;
const CLOUDS_PER_CHUNK = 2;

// Re-declare ALL_TERRAIN_MODELS here if they were not fully listed above
const ALL_TERRAIN_MODELS_PATHS = [
    'assets/models/tree/TreePine.fbx', 'assets/models/tree/TreeRound.fbx',
    'assets/models/rock/Rock1.fbx', 'assets/models/rock/Rock2.fbx', 'assets/models/rock/Rock3.fbx',
    'assets/models/rock/Rock4.fbx', 'assets/models/rock/Rock5.fbx', 'assets/models/rock/Rock6.fbx'
];

/**
 * Calculates terrain height at a specific world coordinate using bilinear interpolation on heightData.
 * @param {number} worldX - The world X coordinate.
 * @param {number} worldZ - The world Z coordinate.
 * @param {number} chunkGridX - The grid X coordinate of the chunk.
 * @param {number} chunkGridZ - The grid Z coordinate of the chunk.
 * @param {number[][]} heightData - The 2D array of height values for the chunk.
 * @param {number} chunkSize - The size of the chunk.
 * @param {number} chunkSegments - The number of segments in the chunk.
 * @returns {number|null} The interpolated height, or null if an error occurs.
 */
function getTerrainHeight(worldX, worldZ, chunkGridX, chunkGridZ, heightData, chunkSize, chunkSegments) {
    const elementSize = chunkSize / chunkSegments;

    // Origin of the heightData grid in world coordinates (min X, min Z corner of the chunk)
    const hfOriginX = (chunkGridX * chunkSize) - (chunkSize / 2);
    const hfOriginZ = (chunkGridZ * chunkSize) - (chunkSize / 2);

    // Coordinates relative to the heightfield origin
    const relativeX = worldX - hfOriginX;
    const relativeZ = worldZ - hfOriginZ;

    // Fractional indices in the heightData grid
    // heightData is indexed [zSegmentIndex][xSegmentIndex]
    const fracX = relativeX / elementSize; // Corresponds to xSegmentIndex
    const fracZ = relativeZ / elementSize; // Corresponds to zSegmentIndex

    // Ensure fractional indices are within the valid range [0, chunkSegments]
    // This should generally be true if object placement is within chunk boundaries.
    if (fracX < 0 || fracX > chunkSegments || fracZ < 0 || fracZ > chunkSegments) {
        console.warn(`Coordinates ${worldX}, ${worldZ} (fracX: ${fracX}, fracZ: ${fracZ}) are outside expected heightData sampling range for chunk ${chunkGridX}, ${chunkGridZ}.`);
        // Clamp to edge if slightly outside, or return null if way off. For now, clamping inside floor/ceil.
    }

    const x1 = Math.floor(fracX);
    const x2 = Math.ceil(fracX);
    const z1 = Math.floor(fracZ);
    const z2 = Math.ceil(fracZ);

    // Clamp indices to be within the bounds of the heightData array [0...chunkSegments]
    const clmp = (val, max) => Math.max(0, Math.min(max, val));
    const cX1 = clmp(x1, chunkSegments);
    const cX2 = clmp(x2, chunkSegments);
    const cZ1 = clmp(z1, chunkSegments);
    const cZ2 = clmp(z2, chunkSegments);

    // Heights at the four corners from heightData[z_idx][x_idx]
    const h_z1x1 = heightData[cZ1]?.[cX1];
    const h_z1x2 = heightData[cZ1]?.[cX2];
    const h_z2x1 = heightData[cZ2]?.[cX1];
    const h_z2x2 = heightData[cZ2]?.[cX2];

    if ([h_z1x1, h_z1x2, h_z2x1, h_z2x2].some(h => typeof h !== 'number')) {
        console.error(`Height data missing or invalid for interpolation at ${worldX}, ${worldZ}. Indices: Z(${cZ1},${cZ2}), X(${cX1},${cX2}). Values: ${h_z1x1}, ${h_z1x2}, ${h_z2x1}, ${h_z2x2}`);
        return null; // Indicate failure
    }

    const tx = fracX - cX1; // Interpolation factor for X
    const tz = fracZ - cZ1; // Interpolation factor for Z

    // Interpolate along x for z1 and z2 rows
    const h_z1 = h_z1x1 * (1 - tx) + h_z1x2 * tx;
    const h_z2 = h_z2x1 * (1 - tx) + h_z2x2 * tx;

    // Interpolate along z
    const interpolatedHeight = h_z1 * (1 - tz) + h_z2 * tz;

    return interpolatedHeight;
}

/**
 * Populates a given terrain chunk with objects. ASYNCHRONOUS.
 * @param {THREE.Scene} scene
 * @param {THREE.Mesh} chunkMesh - The terrain mesh (can be removed if placeModel no longer needs it)
 * @param {number} chunkGridX
 * @param {number} chunkGridZ
 * @param {number[][]} heightData - The height data for this chunk
 * @returns {Promise<THREE.Object3D[]>}
 */
export async function populateChunk(scene, chunkMesh, chunkGridX, chunkGridZ, heightData) {
    const populatedObjectsCollector = [];
    const modelPlacementPromises = [];

    const chunkWorldX_center = chunkGridX * CHUNK_SIZE; // Center of the chunk
    const chunkWorldZ_center = chunkGridZ * CHUNK_SIZE; // Center of the chunk

    // placeModel no longer needs chunkMesh if raycasting is removed for ground objects.
    // It now needs heightData, chunkGridX, chunkGridZ for getTerrainHeight.
    async function placeModel(modelPath, desiredWorldX, desiredWorldZ, desiredWorldY = null, scale) {
        let yPosition;

        if (desiredWorldY !== null) { // For objects with a predefined Y (e.g., clouds)
            yPosition = desiredWorldY;
        } else { // For terrain-bound objects, use heightData
            yPosition = getTerrainHeight(desiredWorldX, desiredWorldZ, chunkGridX, chunkGridZ, heightData, CHUNK_SIZE, CHUNK_SEGMENTS);
            if (yPosition === null) {
                // console.warn(`Failed to get terrain height for object at ${desiredWorldX}, ${desiredWorldZ}. Skipping placement.`);
                return null; // Indicate failure to place
            }
        }

        try {
            const model = await loadFBXModel(modelPath, new THREE.Vector3(desiredWorldX, yPosition, desiredWorldZ), scene, scale);
            return model || null;
        } catch (error) {
            // console.error(`Error loading model ${modelPath} at ${desiredWorldX}, ${yPosition}, ${desiredWorldZ}:`, error);
            return null;
        }
    }

    // Generate clusters of terrain objects
    for (let c = 0; c < CLUSTERS_PER_CHUNK; c++) {
        const clusterLocalX = (Math.random() - 0.5) * CHUNK_SIZE; // Relative to chunk center
        const clusterLocalZ = (Math.random() - 0.5) * CHUNK_SIZE; // Relative to chunk center
        const clusterCenterX = chunkWorldX_center + clusterLocalX;
        const clusterCenterZ = chunkWorldZ_center + clusterLocalZ;

        for (let i = 0; i < OBJECTS_PER_CLUSTER; i++) {
            const angle = Math.random() * 2 * Math.PI;
            const radius = Math.random() * CLUSTER_RADIUS_MAX;
            const objectWorldX = clusterCenterX + Math.cos(angle) * radius;
            const objectWorldZ = clusterCenterZ + Math.sin(angle) * radius;

            // Ensure object is within the current chunk's boundaries
            const halfChunk = CHUNK_SIZE / 2;
            if (objectWorldX >= chunkWorldX_center - halfChunk && objectWorldX <= chunkWorldX_center + halfChunk &&
                objectWorldZ >= chunkWorldZ_center - halfChunk && objectWorldZ <= chunkWorldZ_center + halfChunk) {
                
                const modelPath = ALL_TERRAIN_MODELS_PATHS[Math.floor(Math.random() * ALL_TERRAIN_MODELS_PATHS.length)];
                const randomScale = Math.random() * 0.025 + 0.03; // Example scale
                // Pass necessary parameters to placeModel
                modelPlacementPromises.push(placeModel(modelPath, objectWorldX, objectWorldZ, null, randomScale));
            }
        }
    }

    // Generate clouds
    for (let i = 0; i < CLOUDS_PER_CHUNK; i++) {
        const cloudLocalX = (Math.random() - 0.5) * CHUNK_SIZE;
        const cloudWorldX = chunkWorldX_center + cloudLocalX;
        const cloudLocalZ = (Math.random() - 0.5) * CHUNK_SIZE;
        const cloudWorldZ = chunkWorldZ_center + cloudLocalZ;
        const cloudWorldY = Math.random() * 50 + (TERRAIN_MAX_HEIGHT + 70); // Clouds are placed at a specific Y
        const cloudModelPath = CLOUD_MODELS[Math.floor(Math.random() * CLOUD_MODELS.length)];
        const cloudScale = Math.random() * 0.05 + 0.08;
        // Pass necessary parameters to placeModel
        modelPlacementPromises.push(placeModel(cloudModelPath, cloudWorldX, cloudWorldZ, cloudWorldY, cloudScale));
    }

    const loadedModels = await Promise.all(modelPlacementPromises);

    loadedModels.forEach(model => {
        if (model) {
            populatedObjectsCollector.push(model);
        }
    });
    // console.log(`Chunk ${chunkGridX},${chunkGridZ} populated with ${populatedObjectsCollector.length} objects.`);
    return populatedObjectsCollector;
}