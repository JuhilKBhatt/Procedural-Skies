// LoadFBXModel.js
import * as THREE from 'three';
import { FBXLoader } from 'https://unpkg.com/three@0.152.0/examples/jsm/loaders/FBXLoader.js';

/**
 * Asynchronously loads an FBX model and adds it to the scene.
 * @param {string} modelPath - Path to the FBX model file.
 * @param {THREE.Vector3} location - Position to place the model.
 * @param {THREE.Scene} scene - The scene to add the model to.
 * @param {number} [scale=0.0005] - Uniform scale factor for the model.
 * @returns {Promise<THREE.Object3D>} A promise that resolves with the loaded model object, or rejects on error.
 */
export function loadFBXModel(modelPath, location, scene, scale = 0.0005) {
    return new Promise((resolve, reject) => {
        const loader = new FBXLoader();

        loader.load(
            modelPath,
            (object) => { // onLoad callback
                object.position.copy(location);
                object.scale.set(scale, scale, scale); // Set uniform scale
                scene.add(object);
                resolve(object); // Resolve the promise with the loaded object
            },
            (xhr) => { // onProgress callback
                if (xhr.lengthComputable) {
                    const percentComplete = xhr.loaded / xhr.total * 100;
                    console.log(`Loading model: ${modelPath} , ${Math.round(percentComplete)}% complete`); // Optional progress log
                }
            },
            (error) => { // onError callback
                console.error(`Error loading model ${modelPath}:`, error);
                reject(error); // Reject the promise on error
            }
        );
    });
}