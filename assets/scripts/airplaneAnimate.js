// airplaneAnimate.js
import * as THREE from 'three';

const lerpFactor = 0.05;

export function animateAirplaneRudder(airplane) {
    if (!airplane) return;

    const rudder = airplane.getObjectByName('Tail');
    if (!rudder) {
        console.error('Rudder not found in airplane model');
        return;
    };

    rudder.rotation.y = THREE.MathUtils.lerp(rudder.rotation.z, airplane.targetRudderRotationZ, lerpFactor);
}

export function animateAirplaneElevator(airplane) {
    if (!airplane) return;

    const elevator = airplane.getObjectByName('Plane001');
    if (!elevator){
        console.error('Elevator not found in airplane model');
        return;
    };

    elevator.rotation.x = THREE.MathUtils.lerp(elevator.rotation.x, airplane.targetElevatorRotationX, lerpFactor);
}

export function animateAirplaneEngine(airplane, speed) {
    if (!airplane) return;

    const engine = airplane.getObjectByName('wingRoot');
    if (!engine) {
        console.error('Engine not found in airplane model');
        return;
    }

    const rotationAxis = 'z';
    const rotationSpeed = speed * 0.5;

    // Apply continuous rotation to the engine mesh on the specified axis
    engine.rotation[rotationAxis] += rotationSpeed;
}