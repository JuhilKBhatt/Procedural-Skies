// worldPopulate.js
import * as THREE from 'three';
import { loadFBXModel } from './LoadFBXModel.js'; // Assuming this path is correct
import { CHUNK_SIZE } from './worldGeneration.js'; // Import CHUNK_SIZE

const TREE_MODELS = [
    'assets/models/tree/TreePine.fbx',
    'assets/models/tree/TreeRound.fbx'
];
const ROCK_MODELS = [
    'assets/models/rock/Rock1.fbx', 'assets/models/rock/Rock2.fbx', 'assets/models/rock/Rock3.fbx',
    'assets/models/rock/Rock4.fbx', 'assets/models/rock/Rock5.fbx', 'assets/models/rock/Rock6.fbx'
];
const SEAWEED_MODELS = [
    'assets/models/river/SeaWeed1.fbx', 'assets/models/river/SeaWeed2.fbx'
];
const CLOUD_MODELS = [
    'assets/models/cloud/Cloud_1.fbx', 'assets/models/cloud/Cloud_2.fbx', 'assets/models/cloud/Cloud_3.fbx',
    'assets/models/cloud/Cloud_4.fbx'
];

const ALL_TERRAIN_MODELS = [...TREE_MODELS, ...ROCK_MODELS, ...SEAWEED_MODELS];

// Density parameters (drastically reduced for testing - TUNE THESE YOURSELF!)
const CLUSTERS_PER_CHUNK = 5;   // How many small clusters of objects per chunk
const OBJECTS_PER_CLUSTER = 12;  // Objects within each cluster (was 50)
const CLUSTER_RADIUS_MAX = 20;    // Max radius of a cluster
const CLOUDS_PER_CHUNK = 3;     // Number of clouds (was 50)

const RAYCAST_START_HEIGHT = 150; // Should be above max terrain height + object height (TERRAIN_MAX_HEIGHT is 80)

/**
 * Populates a given terrain chunk with objects like trees, rocks, etc.
 * This function is now ASYNCHRONOUS.
 * @param {THREE.Scene} scene - The Three.js scene object.
 * @param {THREE.Mesh} chunkMesh - The terrain mesh for the current chunk.
 * @param {number} chunkGridX - The grid X coordinate of the chunk.
 * @param {number} chunkGridZ - The grid Z coordinate of the chunk.
 * @returns {Promise<THREE.Object3D[]>} - A Promise that resolves to an array of the root objects added.
 */
export async function populateChunk(scene, chunkMesh, chunkGridX, chunkGridZ) {
    const populatedObjectsCollector = []; // Temp collector for models
    const modelPlacementPromises = [];  // To store promises from placeModel

    const chunkWorldX = chunkGridX * CHUNK_SIZE;
    const chunkWorldZ = chunkGridZ * CHUNK_SIZE;

    async function placeModel(modelPath, desiredWorldX, desiredWorldZ, desiredWorldY = null, scale) {
        const raycaster = new THREE.Raycaster(
            new THREE.Vector3(desiredWorldX, RAYCAST_START_HEIGHT, desiredWorldZ),
            new THREE.Vector3(0, -1, 0)
        );
        const intersects = raycaster.intersectObject(chunkMesh);

        let yPosition;
        if (desiredWorldY !== null) {
            yPosition = desiredWorldY;
        } else if (intersects.length > 0) {
            yPosition = intersects[0].point.y;
        } else {
            return null; // Indicate failure to place by returning null
        }

        try {
            // This 'await' will now correctly wait for the Promise from loadFBXModel
            const model = await loadFBXModel(modelPath, new THREE.Vector3(desiredWorldX, yPosition, desiredWorldZ), scene, 0.025); // Ensure you are using the 'scale' parameter here
            return model || null; 
        } catch (error) {
            return null; 
        }
    }

    // Generate clusters of terrain objects
    for (let c = 0; c < CLUSTERS_PER_CHUNK; c++) {
        const clusterLocalX = (Math.random() - 0.5) * CHUNK_SIZE;
        const clusterLocalZ = (Math.random() - 0.5) * CHUNK_SIZE;
        const clusterCenterX = chunkWorldX + clusterLocalX;
        const clusterCenterZ = chunkWorldZ + clusterLocalZ;

        for (let i = 0; i < OBJECTS_PER_CLUSTER; i++) {
            const angle = Math.random() * 2 * Math.PI;
            const radius = Math.random() * CLUSTER_RADIUS_MAX;
            const objectWorldX = clusterCenterX + Math.cos(angle) * radius;
            const objectWorldZ = clusterCenterZ + Math.sin(angle) * radius;

            if (objectWorldX >= chunkWorldX - CHUNK_SIZE / 2 && objectWorldX <= chunkWorldX + CHUNK_SIZE / 2 &&
                objectWorldZ >= chunkWorldZ - CHUNK_SIZE / 2 && objectWorldZ <= chunkWorldZ + CHUNK_SIZE / 2) {
                const modelPath = ALL_TERRAIN_MODELS[Math.floor(Math.random() * ALL_TERRAIN_MODELS.length)];
                const randomScale = Math.random() * 0.05 + 0.08;
                modelPlacementPromises.push(placeModel(modelPath, objectWorldX, objectWorldZ, null, randomScale));
            }
        }
    }

    // Generate clouds
    for (let i = 0; i < CLOUDS_PER_CHUNK; i++) {
        const cloudLocalX = (Math.random() - 0.5) * CHUNK_SIZE;
        const cloudWorldX = chunkWorldX + cloudLocalX;
        const cloudLocalZ = (Math.random() - 0.5) * CHUNK_SIZE;
        const cloudWorldZ = chunkWorldZ + cloudLocalZ;
        const cloudWorldY = Math.random() * 50 + (TERRAIN_MAX_HEIGHT + 70);
        const cloudModelPath = CLOUD_MODELS[Math.floor(Math.random() * CLOUD_MODELS.length)];
        const cloudScale = Math.random() * 0.02 + 0.05;
        modelPlacementPromises.push(placeModel(cloudModelPath, cloudWorldX, cloudWorldZ, cloudWorldY, cloudScale));
    }

    // Wait for all model placement attempts to complete
    const loadedModels = await Promise.all(modelPlacementPromises);

    // Filter out any null results (failed loads/placements) and add to the collector
    loadedModels.forEach(model => {
        if (model) { // Check if the model loaded successfully
            populatedObjectsCollector.push(model);
        }
    });
    // console.log(`Chunk ${chunkGridX},${chunkGridZ} populated with ${populatedObjectsCollector.length} objects.`);
    return populatedObjectsCollector;
}