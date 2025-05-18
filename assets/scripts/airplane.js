// airplane.js
import * as THREE from 'three';
import { loadFBXModel } from './LoadFBXModel.js';
import { animateAirplaneRudder, animateAirplaneElevator, animateAirplaneEngine } from './airplaneAnimate.js';

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

    // Rudder animation parameter (renamed for clarity)
    airplane.targetRudderRotationZ = 0; // Add this line to store the target rudder rotation

    // Elevator animation parameter
    airplane.targetElevatorRotationX = 0; // Add this line to store the target elevator rotation

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

    // Animate airplane rudder by calling the imported function (renamed method)
    airplane.animateRudder = function () {
        animateAirplaneRudder(this);
    };

    // Animate airplane elevator by calling the imported function (new method)
    airplane.animateElevator = function () {
        animateAirplaneElevator(this);
    };

    // Animate airplane engine (pass speed to the animation function)
    airplane.animateEngine = function () {
        animateAirplaneEngine(this, this.speed); // Pass the current speed
    };

    scene.add(airplane);
    return airplane;
}