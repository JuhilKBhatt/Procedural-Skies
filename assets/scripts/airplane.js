// airplane.js
import * as THREE from 'three';
import { loadFBXModel } from './LoadFBXModel.js';

export function createAirplane(scene) {
    const modelPath = 'assets/models/plane/Airplane.fbx';
    const airplane = new THREE.Group();
    loadFBXModel(modelPath, new THREE.Vector3(0, 20, 0), airplane, 0.005);
    airplane.rotateY(Math.PI);

    // Movement parameters
    airplane.speed = 0;
    airplane.maxSpeed = 1;
    airplane.speedIncrement = 0.01;
    airplane.velocity = new THREE.Vector3();

    // Update airplane position based on velocity
    airplane.updatePosition = function () {
        this.position.add(this.velocity);
    };

    // Update airplane speed and direction
    airplane.updateSpeed = function (forward, sideways) {
        const direction = new THREE.Vector3(Math.sin(this.rotation.y), 0, Math.cos(this.rotation.y));
        this.velocity.copy(direction.multiplyScalar(forward * this.speed));
        this.velocity.x += sideways * this.speed;
    };

    scene.add(airplane);
    return airplane;
}