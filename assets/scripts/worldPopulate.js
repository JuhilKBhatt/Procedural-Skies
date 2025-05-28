// assets/scripts/worldPopulate.js
import * as THREE from 'three';
import { loadFBXModel } from './LoadFBXModel.js';

const CLOUD_MODELS = [
    'assets/models/cloud/Cloud_1.fbx', 'assets/models/cloud/Cloud_2.fbx', 'assets/models/cloud/Cloud_3.fbx',
    'assets/models/cloud/Cloud_4.fbx'
];

const CLUSTER_RADIUS_MAX = 10;

const ALL_TERRAIN_MODELS_PATHS = [
    'assets/models/tree/TreePine.fbx', 'assets/models/tree/TreeRound.fbx',
    'assets/models/rock/Rock1.fbx', 'assets/models/rock/Rock2.fbx', 'assets/models/rock/Rock3.fbx',
    'assets/models/rock/Rock4.fbx', 'assets/models/rock/Rock5.fbx', 'assets/models/rock/Rock6.fbx'
];

function getTerrainHeight(worldX, worldZ, chunkGridX, chunkGridZ, heightData, chunkSize, chunkSegments) {
    const elementSize = chunkSize / chunkSegments;
    const hfOriginX = (chunkGridX * chunkSize) - (chunkSize / 2);
    const hfOriginZ = (chunkGridZ * chunkSize) - (chunkSize / 2);
    const relativeX = worldX - hfOriginX;
    const relativeZ = worldZ - hfOriginZ;
    const fracX = relativeX / elementSize;
    const fracZ = relativeZ / elementSize;

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
    currentChunkSize,
    currentChunkSegments
) {
    const { CLUSTERS_PER_CHUNK, OBJECTS_PER_CLUSTER, CLOUDS_PER_CHUNK } = worldPopSettings;
    const { TERRAIN_MAX_HEIGHT } = worldGenSettings;

    const populatedObjectsCollector = [];
    const modelPlacementPromises = [];

    const chunkWorldX_center = chunkGridX * currentChunkSize;
    const chunkWorldZ_center = chunkGridZ * currentChunkSize;

    // Place a model at a specific world position
    async function placeModel(modelPath, desiredWorldX, desiredWorldZ, desiredWorldY = null, scale) {
        let yPosition;

        if (desiredWorldY !== null) {
            yPosition = desiredWorldY;
        } else {
            yPosition = getTerrainHeight(desiredWorldX, desiredWorldZ, chunkGridX, chunkGridZ, heightData, currentChunkSize, currentChunkSegments);
            if (yPosition === null) {
                return null;
            }
        }

        try {
            const model = await loadFBXModel(modelPath, new THREE.Vector3(desiredWorldX, yPosition, desiredWorldZ), scene, scale);
            return model || null;
        } catch (error) {
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
        const cloudWorldY = Math.random() * 50 + (TERRAIN_MAX_HEIGHT + 70);
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