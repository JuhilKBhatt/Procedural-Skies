// assets/scripts/worldPopulate.js
import * as THREE from 'three';
import { loadFBXModel } from './LoadFBXModel.js';
// CHUNK_SIZE, TERRAIN_MAX_HEIGHT, CHUNK_SEGMENTS are now passed as parameters or taken from settings objects

const CLOUD_MODELS = [
    'assets/models/cloud/Cloud_1.fbx', 'assets/models/cloud/Cloud_2.fbx', 'assets/models/cloud/Cloud_3.fbx',
    'assets/models/cloud/Cloud_4.fbx'
];

const CLUSTER_RADIUS_MAX = 10; // This can also be made a setting if desired

const ALL_TERRAIN_MODELS_PATHS = [
    'assets/models/tree/TreePine.fbx', 'assets/models/tree/TreeRound.fbx',
    'assets/models/rock/Rock1.fbx', 'assets/models/rock/Rock2.fbx', 'assets/models/rock/Rock3.fbx',
    'assets/models/rock/Rock4.fbx', 'assets/models/rock/Rock5.fbx', 'assets/models/rock/Rock6.fbx'
];

// getTerrainHeight function remains the same as provided in the prompt.
// Ensure it's defined here or imported if it's in a separate utility.
// For brevity, I'm assuming it's defined as in your provided snippet.
function getTerrainHeight(worldX, worldZ, chunkGridX, chunkGridZ, heightData, chunkSize, chunkSegments) {
    const elementSize = chunkSize / chunkSegments;
    const hfOriginX = (chunkGridX * chunkSize) - (chunkSize / 2);
    const hfOriginZ = (chunkGridZ * chunkSize) - (chunkSize / 2);
    const relativeX = worldX - hfOriginX;
    const relativeZ = worldZ - hfOriginZ;
    const fracX = relativeX / elementSize;
    const fracZ = relativeZ / elementSize;

    if (fracX < 0 || fracX > chunkSegments || fracZ < 0 || fracZ > chunkSegments) {
        // console.warn(`Coordinates ${worldX}, ${worldZ} (fracX: ${fracX}, fracZ: ${fracZ}) are outside expected heightData sampling range for chunk ${chunkGridX}, ${chunkGridZ}.`);
        // Return a value at the edge or null. For simplicity, clamping might lead to objects at edge.
        // Depending on strictness, can return null.
    }

    const x1 = Math.floor(fracX);
    const x2 = Math.ceil(fracX);
    const z1 = Math.floor(fracZ);
    const z2 = Math.ceil(fracZ);

    const clmp = (val, max) => Math.max(0, Math.min(max, val));
    const cX1 = clmp(x1, chunkSegments);
    const cX2 = clmp(x2, chunkSegments);
    const cZ1 = clmp(z1, chunkSegments);
    const cZ2 = clmp(z2, chunkSegments);

    const h_z1x1 = heightData[cZ1]?.[cX1];
    const h_z1x2 = heightData[cZ1]?.[cX2];
    const h_z2x1 = heightData[cZ2]?.[cX1];
    const h_z2x2 = heightData[cZ2]?.[cX2];

    if ([h_z1x1, h_z1x2, h_z2x1, h_z2x2].some(h => typeof h !== 'number')) {
        // console.error(`Height data missing for interpolation at ${worldX}, ${worldZ}. Indices: Z(${cZ1},${cZ2}), X(${cX1},${cX2}). Values: ${h_z1x1}, ${h_z1x2}, ${h_z2x1}, ${h_z2x2}`);
        return (heightData[0]?.[0] !== undefined) ? heightData[0][0] : 0; // Fallback to a default height or origin height
    }

    const tx = fracX - cX1;
    const tz = fracZ - cZ1;
    const h_z1 = h_z1x1 * (1 - tx) + h_z1x2 * tx;
    const h_z2 = h_z2x1 * (1 - tx) + h_z2x2 * tx;
    const interpolatedHeight = h_z1 * (1 - tz) + h_z2 * tz;
    return interpolatedHeight;
}


/**
 * Populates a given terrain chunk with objects. ASYNCHRONOUS.
 * @param {THREE.Scene} scene
 * @param {THREE.Mesh} chunkMesh (can be used for reference, but heightData is primary for Y pos)
 * @param {number} chunkGridX
 * @param {number} chunkGridZ
 * @param {number[][]} heightData
 * @param {object} worldGenSettings - Contains TERRAIN_MAX_HEIGHT for cloud placement
 * @param {object} worldPopSettings - Contains CLUSTERS_PER_CHUNK, OBJECTS_PER_CLUSTER, CLOUDS_PER_CHUNK
 * @param {number} currentChunkSize - The CHUNK_SIZE value
 * @param {number} currentChunkSegments - The CHUNK_SEGMENTS value
 * @returns {Promise<THREE.Object3D[]>}
 */
export async function populateChunk(
    scene,
    chunkMesh,
    chunkGridX,
    chunkGridZ,
    heightData,
    worldGenSettings,
    worldPopSettings,
    currentChunkSize,     // Renamed to avoid conflict with any global CHUNK_SIZE if it existed
    currentChunkSegments  // Renamed for clarity
) {
    const { CLUSTERS_PER_CHUNK, OBJECTS_PER_CLUSTER, CLOUDS_PER_CHUNK } = worldPopSettings;
    const { TERRAIN_MAX_HEIGHT } = worldGenSettings; // For cloud height calculation

    const populatedObjectsCollector = [];
    const modelPlacementPromises = [];

    const chunkWorldX_center = chunkGridX * currentChunkSize;
    const chunkWorldZ_center = chunkGridZ * currentChunkSize;

    async function placeModel(modelPath, desiredWorldX, desiredWorldZ, desiredWorldY = null, scale) {
        let yPosition;

        if (desiredWorldY !== null) {
            yPosition = desiredWorldY;
        } else {
            yPosition = getTerrainHeight(desiredWorldX, desiredWorldZ, chunkGridX, chunkGridZ, heightData, currentChunkSize, currentChunkSegments);
            if (yPosition === null) {
                // console.warn(`Failed to get terrain height for object at ${desiredWorldX}, ${desiredWorldZ}. Skipping.`);
                return null;
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
        const clusterLocalX = (Math.random() - 0.5) * currentChunkSize;
        const clusterLocalZ = (Math.random() - 0.5) * currentChunkSize;
        const clusterCenterX = chunkWorldX_center + clusterLocalX;
        const clusterCenterZ = chunkWorldZ_center + clusterLocalZ;

        for (let i = 0; i < OBJECTS_PER_CLUSTER; i++) {
            const angle = Math.random() * 2 * Math.PI;
            const radius = Math.random() * CLUSTER_RADIUS_MAX;
            const objectWorldX = clusterCenterX + Math.cos(angle) * radius;
            const objectWorldZ = clusterCenterZ + Math.sin(angle) * radius;

            const halfChunk = currentChunkSize / 2;
            if (objectWorldX >= chunkWorldX_center - halfChunk && objectWorldX <= chunkWorldX_center + halfChunk &&
                objectWorldZ >= chunkWorldZ_center - halfChunk && objectWorldZ <= chunkWorldZ_center + halfChunk) {

                const modelPath = ALL_TERRAIN_MODELS_PATHS[Math.floor(Math.random() * ALL_TERRAIN_MODELS_PATHS.length)];
                const randomScale = Math.random() * 0.025 + 0.03;
                modelPlacementPromises.push(placeModel(modelPath, objectWorldX, objectWorldZ, null, randomScale));
            }
        }
    }

    // Generate clouds
    for (let i = 0; i < CLOUDS_PER_CHUNK; i++) {
        const cloudLocalX = (Math.random() - 0.5) * currentChunkSize;
        const cloudWorldX = chunkWorldX_center + cloudLocalX;
        const cloudLocalZ = (Math.random() - 0.5) * currentChunkSize;
        const cloudWorldZ = chunkWorldZ_center + cloudLocalZ;
        const cloudWorldY = Math.random() * 50 + (TERRAIN_MAX_HEIGHT + 70); // Use TERRAIN_MAX_HEIGHT from settings
        const cloudModelPath = CLOUD_MODELS[Math.floor(Math.random() * CLOUD_MODELS.length)];
        const cloudScale = Math.random() * 0.05 + 0.08;
        modelPlacementPromises.push(placeModel(cloudModelPath, cloudWorldX, cloudWorldZ, cloudWorldY, cloudScale));
    }

    const loadedModels = await Promise.all(modelPlacementPromises);
    loadedModels.forEach(model => {
        if (model) populatedObjectsCollector.push(model);
    });
    return populatedObjectsCollector;
}