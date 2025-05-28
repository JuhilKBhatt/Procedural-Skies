// assets/scripts/airplaneAnimate.js
import * as THREE from 'three';

const lerpFactor = 0.05;

export function animateAirplaneRudder(airplane) {
    if (!airplane) return;

    const rudder = airplane.getObjectByName('Tail');
    if (!rudder) {
        return;
    }
    rudder.rotation.y = THREE.MathUtils.lerp(rudder.rotation.y, airplane.targetRudderRotation, lerpFactor);
}

export function animateAirplaneElevator(airplane) {
    if (!airplane) return;

    const elevator = airplane.getObjectByName('Plane001'); 
    if (!elevator) {
        return;
    }
    elevator.rotation.x = THREE.MathUtils.lerp(elevator.rotation.x, airplane.targetElevatorRotation, lerpFactor);
}

export function animateAirplaneEngine(airplane, speed) {
    if (!airplane) return;

    const engine = airplane.getObjectByName('wingRoot');
    if (!engine) {
        return;
    }

    const rotationAxis = 'z';
    const rotationSpeed = speed * 0.5;

    // Apply continuous rotation to the engine mesh on the specified axis
    engine.rotation[rotationAxis] += rotationSpeed;
}