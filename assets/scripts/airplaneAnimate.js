// assets/scripts/airplaneAnimate.js
import * as THREE from 'three';

const lerpFactor = 0.05;

export function animateAirplaneRudder(airplane) {
    if (!airplane) return;

    const rudder = airplane.getObjectByName('Tail'); // Ensure 'Tail' is the correct name of the rudder mesh
    if (!rudder) {
        // console.warn("Rudder mesh 'Tail' not found in airplane model.");
        return;
    }

    // Assuming rudder rotates around its local Y-axis for yaw.
    // Use airplane.targetRudderRotation which is set in airplane.js
    rudder.rotation.y = THREE.MathUtils.lerp(rudder.rotation.y, airplane.targetRudderRotation, lerpFactor);
}

export function animateAirplaneElevator(airplane) {
    if (!airplane) return;

    const elevator = airplane.getObjectByName('Plane001'); // Ensure 'Plane001' is the correct name of the elevator mesh
    if (!elevator) {
        // console.warn("Elevator mesh 'Plane001' not found in airplane model.");
        return;
    }

    // Assuming elevator rotates around its local X-axis for pitch.
    // Use airplane.targetElevatorRotation which is set in airplane.js
    elevator.rotation.x = THREE.MathUtils.lerp(elevator.rotation.x, airplane.targetElevatorRotation, lerpFactor);
}

export function animateAirplaneEngine(airplane, speed) {
    if (!airplane) return;

    const engine = airplane.getObjectByName('wingRoot'); // Ensure 'wingRoot' is the correct name for the part to animate
    if (!engine) {
        // console.warn("Engine mesh 'wingRoot' not found in airplane model.");
        return;
    }

    const rotationAxis = 'z'; // Or 'x', 'y' depending on the model's orientation
    const rotationSpeed = speed * 0.5; // Adjust speed factor as needed

    // Apply continuous rotation to the engine mesh on the specified axis
    engine.rotation[rotationAxis] += rotationSpeed;
}