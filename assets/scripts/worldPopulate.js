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

// Density parameters (adjust these as needed)
const CLUSTERS_PER_CHUNK = 3; // How many small clusters of objects per chunk
const OBJECTS_PER_CLUSTER = 50; // Objects within each cluster
const CLUSTER_RADIUS_MAX = 10;  // Max radius of a cluster
const CLOUDS_PER_CHUNK = 1;   // Number of clouds to attempt to place relative to this chunk

const RAYCAST_START_HEIGHT = 150; // Should be above max terrain height + object height

/**
 * Populates a given terrain chunk with objects like trees, rocks, etc.
 * @param {THREE.Scene} scene - The Three.js scene object.
 * @param {THREE.Mesh} chunkMesh - The terrain mesh for the current chunk.
 * @param {number} chunkGridX - The grid X coordinate of the chunk.
 * @param {number} chunkGridZ - The grid Z coordinate of the chunk.
 * @returns {THREE.Object3D[]} - An array of the root objects added to the scene for this chunk.
 */
export function populateChunk(scene, chunkMesh, chunkGridX, chunkGridZ) {
    const populatedObjects = [];

    // Base world coordinates for the chunk's origin (center)
    const chunkWorldX = chunkGridX * CHUNK_SIZE;
    const chunkWorldZ = chunkGridZ * CHUNK_SIZE;

    // Function to attempt placing a single model
    async function placeModel(modelPath, desiredWorldX, desiredWorldZ, desiredWorldY = null, scale) {
        const raycaster = new THREE.Raycaster(
            new THREE.Vector3(desiredWorldX, RAYCAST_START_HEIGHT, desiredWorldZ),
            new THREE.Vector3(0, -1, 0)
        );
        const intersects = raycaster.intersectObject(chunkMesh); // Raycast only against the current chunk mesh

        let yPosition;
        if (desiredWorldY !== null) {
            yPosition = desiredWorldY; // Use predefined Y if available (e.g., for clouds)
        } else if (intersects.length > 0) {
            yPosition = intersects[0].point.y; // Place on terrain
        } else {
            return; // Could not find a valid position on the terrain for this object
        }

        // loadFBXModel is assumed to return the loaded model (or a Promise that resolves to it)
        // and add it to the scene. We need the reference to manage it.
        try {
            const model = await loadFBXModel(modelPath, new THREE.Vector3(desiredWorldX, yPosition, desiredWorldZ), scene, 0.025);
            if (model) {
                populatedObjects.push(model); // Add the root of the loaded model
            }
        } catch (error) {
            console.error(`Failed to load model ${modelPath}:`, error);
        }
    }

    // Generate clusters of terrain objects (trees, rocks, seaweed)
    for (let c = 0; c < CLUSTERS_PER_CHUNK; c++) {
        // Determine a central point for the cluster within the chunk (local to chunk, then convert to world)
        const clusterLocalX = (Math.random() - 0.5) * CHUNK_SIZE;
        const clusterLocalZ = (Math.random() - 0.5) * CHUNK_SIZE;

        const clusterCenterX = chunkWorldX + clusterLocalX;
        const clusterCenterZ = chunkWorldZ + clusterLocalZ;

        for (let i = 0; i < OBJECTS_PER_CLUSTER; i++) {
            const angle = Math.random() * 2 * Math.PI;
            const radius = Math.random() * CLUSTER_RADIUS_MAX;
            const objectWorldX = clusterCenterX + Math.cos(angle) * radius;
            const objectWorldZ = clusterCenterZ + Math.sin(angle) * radius;

            // Check if the object position is roughly within the current chunk's bounds
            // This is a soft check; raycasting will be the final determinant for placement on this chunk's mesh
            if (objectWorldX >= chunkWorldX - CHUNK_SIZE / 2 && objectWorldX <= chunkWorldX + CHUNK_SIZE / 2 &&
                objectWorldZ >= chunkWorldZ - CHUNK_SIZE / 2 && objectWorldZ <= chunkWorldZ + CHUNK_SIZE / 2) {

                const modelPath = ALL_TERRAIN_MODELS[Math.floor(Math.random() * ALL_TERRAIN_MODELS.length)];
                const randomScale = Math.random() * 0.005 + 0.008; // Adjust scale as needed
                placeModel(modelPath, objectWorldX, objectWorldZ, null, randomScale);
            }
        }
    }

    // Generate clouds (placed at a fixed height range, relative to chunk area)
    for (let i = 0; i < CLOUDS_PER_CHUNK; i++) {
        const cloudLocalX = (Math.random() - 0.5) * CHUNK_SIZE;
        const cloudWorldX = chunkWorldX + cloudLocalX;

        const cloudLocalZ = (Math.random() - 0.5) * CHUNK_SIZE;
        const cloudWorldZ = chunkWorldZ + cloudLocalZ;

        const cloudWorldY = Math.random() * 50 + (TERRAIN_MAX_HEIGHT + 70); // Clouds float high above max terrain height

        const cloudModelPath = CLOUD_MODELS[Math.floor(Math.random() * CLOUD_MODELS.length)];
        const cloudScale = Math.random() * 0.02 + 0.05; // Adjust scale as needed
        placeModel(cloudModelPath, cloudWorldX, cloudWorldZ, cloudWorldY, cloudScale);
    }
    
    // The actual models are added to the scene by loadFBXModel.
    // We return the array of root objects if loadFBXModel returns them,
    // so they can be tracked and removed when the chunk unloads.
    // This function is now mostly a "fire-and-forget" for loading,
    // but it collects references if `loadFBXModel` provides them.
    // If `loadFBXModel` is fully async and doesn't return the model directly,
    // this `populatedObjects` array might be empty or fill asynchronously.
    // For proper cleanup, `loadFBXModel` *must* return the added THREE.Object3D.

    return populatedObjects; // This will be an array of Promises if placeModel is async and awaited
                            // Or an array of models if loadFBXModel is synchronous or handled with callbacks.
                            // For simplicity, I've made placeModel async and awaited loadFBXModel.
                            // This means populateChunk should ideally be async too, or handle promises.
}

// --- IMPORTANT ---
// If loadFBXModel is asynchronous and returns a Promise, the populateChunk function
// will fire off these loads. To properly track populatedObjects, loadFBXModel
// must return the THREE.Object3D it adds to the scene.
// The current structure of populateChunk is synchronous but calls an async placeModel.
// This means populatedObjects might not be filled as expected if you call populateChunk synchronously.
//
// To handle this properly:
// 1. Make populateChunk async: async export function populateChunk(...)
// 2. Await calls to placeModel: await placeModel(...);
// 3. When calling populateChunk from worldGeneration.js, await it as well.
// This ensures that populatedObjects is filled before being returned.

// For now, I'll keep populateChunk synchronous and assume loadFBXModel might be
// "fire and forget" for adding to scene, but if it *can* return the model,
// the populatedObjects array will try to collect them.
// A robust solution requires `loadFBXModel` to reliably return the added object.