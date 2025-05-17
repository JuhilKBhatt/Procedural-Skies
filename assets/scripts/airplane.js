import * as THREE from 'three';
import { loadFBXModel } from './LoadFBXModel.js';

let airplane;

function createAirplane(scene, onLoaded) {
    const airplanePath = 'assets/models/airplane/Airplane.fbx'; // Update with your model path
    const startPosition = new THREE.Vector3(0, 10, 0); // Initial position of the airplane

    loadFBXModel(airplanePath, startPosition, scene, 0.01, (object) => {
        airplane = object;
        airplane.rotation.y = Math.PI; // Optional: adjust orientation
        if (onLoaded) onLoaded(airplane);
    });
}

function updateAirplane(deltaTime) {
    if (!airplane) return;

    // Move the airplane forward
    const speed = 20;
    const direction = new THREE.Vector3(0, 0, -1); // Forward direction
    direction.applyQuaternion(airplane.quaternion); // Adjust direction based on rotation
    direction.multiplyScalar(speed * deltaTime);
    airplane.position.add(direction);
}

function getAirplane() {
    return airplane;
}

export { createAirplane, updateAirplane, getAirplane };