// airplane.js
import * as THREE from 'three';
import { loadFBXModel } from './LoadFBXModel.js';
import { animateAirplaneRudder, animateAirplaneElevator, animateAirplaneEngine } from './airplaneAnimate.js';

export function createAirplane(scene) {
    const modelPath = 'assets/models/plane/Airplane.fbx';
    const airplane = new THREE.Group();
    loadFBXModel(modelPath, new THREE.Vector3(0, 0, 0), airplane, 0.02);
    airplane.position.set(0, 100, -180);

    // Movement parameters
    airplane.speed = 0;
    airplane.maxSpeed = 1;
    airplane.speedIncrement = 0.01;
    airplane.velocity = new THREE.Vector3();

    // Rudder animation parameter
    airplane.targetRudderRotationZ = 0;

    // Elevator animation parameter
    airplane.targetElevatorRotationX = 0;

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

    // Animate airplane rudder by calling the imported function
    airplane.animateRudder = function () {
        animateAirplaneRudder(this);
    };

    // Animate airplane elevator by calling the imported function
    airplane.animateElevator = function () {
        animateAirplaneElevator(this);
    };

    // Animate airplane engine
    airplane.animateEngine = function () {
        animateAirplaneEngine(this, this.speed);
    };

    scene.add(airplane);
    return airplane;
}