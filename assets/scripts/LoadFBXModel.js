import * as THREE from 'three';
import { FBXLoader } from 'https://unpkg.com/three@0.152.0/examples/jsm/loaders/FBXLoader.js';

/**
 * @param {string} modelPath - Path to the FBX model file.
 * @param {THREE.Vector3} location - Position to place the model.
 * @param {THREE.Scene} scene - The scene to add the model to.
 * @param {number} [scale=1] - Uniform scale factor for the model.
 * @param {function} [onLoaded] - Callback function when the model is loaded.
 */
function loadFBXModel(modelPath, location, scene, scale = 0.0005, onLoaded) {
    const loader = new FBXLoader();

    loader.load(
        modelPath,
        (object) => {
            object.position.copy(location);
            object.scale.set(scale, scale, scale); // Set uniform scale
            scene.add(object);

            if (onLoaded) {
                onLoaded(object);
            }
            console.log('FBX model loaded successfully:', modelPath);
        },
        (xhr) => {
            if (xhr.lengthComputable) {
                const percentComplete = xhr.loaded / xhr.total * 100;
                console.log(`FBX model ${modelPath} loading: ${percentComplete.toFixed(2)}% loaded`);
            } else {
                console.log(`FBX model ${modelPath} loading: loading...`);
            }
        },
        (error) => {
            console.error('Error loading FBX model:', modelPath, error);
        }
    );
}

export { loadFBXModel };