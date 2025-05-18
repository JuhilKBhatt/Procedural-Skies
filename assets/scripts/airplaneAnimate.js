// airplaneAnimate.js
import * as THREE from 'three';

export function animateAirplaneRudder(airplane) {
    if (!airplane) return;

    // Assume the rudder is a child mesh of the airplane group
    // You might need to adjust 'Tail' based on the actual name in your FBX model
    // We are targeting the Z-axis for rudder rotation
    const rudder = airplane.getObjectByName('Tail'); // Assuming 'Tail' contains the rudder
    if (!rudder) return;

    // Smoothly interpolate the rudder's rotation towards the target rotation
    const lerpFactor = 0.1; // Adjust this value for slower or faster interpolation
    rudder.rotation.y = THREE.MathUtils.lerp(rudder.rotation.z, airplane.targetRudderRotationZ, lerpFactor);
}

export function animateAirplaneElevator(airplane) {
    if (!airplane) return;

    // Assume the elevator is a child mesh of the airplane group
    // You might need to adjust 'Plane001' based on the actual name in your FBX model
    // We are targeting the X-axis for elevator rotation
    const elevator = airplane.getObjectByName('Plane001'); // Assuming 'Plane001' is the elevator
    if (!elevator) return;

    // Smoothly interpolate the elevator's rotation towards the target rotation
    const lerpFactor = 0.01; // Adjust this value for slower or faster interpolation
    elevator.rotation.x = THREE.MathUtils.lerp(elevator.rotation.x, airplane.targetElevatorRotationX, lerpFactor);
}