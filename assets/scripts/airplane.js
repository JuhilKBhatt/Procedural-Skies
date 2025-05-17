import * as THREE from 'three';
import { loadFBXModel } from './LoadFBXModel.js';

let airplane;
const cameraOffset = new THREE.Vector3(0, 10, -20); // Camera offset behind the airplane

/**
 * Loads the airplane model and sets up the camera for a 3rd person perspective.
 * @param {THREE.Scene} scene - The scene to add the airplane to.
 * @param {THREE.Camera} camera - The camera to set in the 3rd person perspective.
 */
export function loadAirplane(scene, camera) {
    const airplanePosition = new THREE.Vector3(0, 20, 0); // Higher initial position to avoid ground collision

    loadFBXModel('assets/models/airplane/Airplane.fbx', airplanePosition, scene, 0.01, (object) => {
        airplane = object;
        airplane.rotation.y = Math.PI; // Adjust orientation

        // Set camera initially behind the airplane
        updateCameraPosition(camera);

        scene.add(airplane);
        console.log('Airplane loaded and placed in the scene.');
    });
}

/**
 * Updates the camera to follow the airplane in a 3rd person view.
 * @param {THREE.Camera} camera - The camera to update.
 */
export function updateCameraPosition(camera) {
    if (!airplane) return;

    // Calculate the new camera position
    const airplanePosition = airplane.position.clone();
    const offset = cameraOffset.clone().applyQuaternion(airplane.quaternion);

    // Update camera position and orientation
    camera.position.copy(airplanePosition.add(offset));
    camera.lookAt(airplane.position.clone().add(new THREE.Vector3(0, 5, 0))); // Look slightly above the airplane
}

/**
 * Updates the airplane's position and rotation based on input.
 * @param {number} delta - The time delta for smooth movement.
 * @param {object} input - An object containing movement input (forward, left, right).
 */
export function updateAirplane(delta, input) {
    if (!airplane) return;

    const speed = 20;
    const rotationSpeed = Math.PI / 2;

    if (input.forward) {
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(airplane.quaternion);
        airplane.position.add(forward.multiplyScalar(speed * delta));
    }
    if (input.left) {
        airplane.rotation.y += rotationSpeed * delta;
    }
    if (input.right) {
        airplane.rotation.y -= rotationSpeed * delta;
    }
}