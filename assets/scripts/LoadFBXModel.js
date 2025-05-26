// LoadFBXModel.js
import * as THREE from 'three';
import { FBXLoader } from 'https://unpkg.com/three@0.152.0/examples/jsm/loaders/FBXLoader.js';

// Cache for storing the promise of the *first* load of a unique model path.
// The promise will resolve with the "raw" THREE.Object3D before any scene-specific transformations or cloning.
const rawModelLoadPromises = new Map();

/**
 * Asynchronously loads an FBX model. If the model asset has already been loaded,
 * it clones the cached asset instead of re-fetching and re-parsing the file.
 * Each returned model is a new instance, positioned and scaled as specified.
 *
 * @param {string} modelPath - Path to the FBX model file.
 * @param {THREE.Vector3} location - Position to place this instance of the model.
 * @param {THREE.Scene} scene - The scene to add this instance of the model to.
 * @param {number} [scale=0.0005] - Uniform scale factor for this instance of the model.
 * @returns {Promise<THREE.Object3D>} A promise that resolves with the configured model instance,
 * or rejects on error.
 */
export function loadFBXModel(modelPath, location, scene, scale = 0.0005) {
    let rawModelPromise;

    if (rawModelLoadPromises.has(modelPath)) {
        rawModelPromise = rawModelLoadPromises.get(modelPath);
    } else {
        rawModelPromise = new Promise((resolve, reject) => {
            const loader = new FBXLoader();
            loader.load(
                modelPath,
                (loadedObject) => { // This is the "raw" loaded object.
                    resolve(loadedObject);
                },
                (xhr) => { // onProgress callback for the initial load
                    if (xhr.lengthComputable) {
                        const percentComplete = xhr.loaded / xhr.total * 100;
                        // console.log(`Initial load: ${modelPath} , ${Math.round(percentComplete)}% complete`);
                    }
                },
                (error) => {
                    console.error(`Error during initial load of raw model ${modelPath}:`, error);
                    // Remove from cache on failure so a subsequent attempt can retry the load.
                    rawModelLoadPromises.delete(modelPath);
                    reject(error);
                }
            );
        });
        rawModelLoadPromises.set(modelPath, rawModelPromise);
    }
    return rawModelPromise.then(rawModel => {
        const modelInstance = rawModel.clone(); // Deep clone the raw model

        modelInstance.position.copy(location);
        modelInstance.scale.set(scale, scale, scale);
        scene.add(modelInstance);
        return modelInstance;
    }).catch(error => {
        throw error; // Re-throw to be caught by the caller (e.g., in populateChunk)
    });
}