// assets/scripts/LoadFBXModel.js
import * as THREE from 'three';
import { FBXLoader } from 'https://unpkg.com/three@0.152.0/examples/jsm/loaders/FBXLoader.js';

// Cache for storing the promise
const rawModelLoadPromises = new Map();

/**
 * @param {string} modelPath - Path to the FBX model file.
 * @param {THREE.Vector3} location - Position to place this instance of the model.
 * @param {THREE.Scene} scene - The scene to add this instance of the model to.
 * @param {number} [scale=0.0005] - Uniform scale factor for this instance of the model.
 * @returns {Promise<THREE.Object3D>} A promise that resolves with the configured model instance,
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
        throw error;
    });
}