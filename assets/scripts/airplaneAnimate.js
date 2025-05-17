// airplaneAnimate.js
import * as THREE from 'three';

export function animateAirplaneTail(airplane) {
    if (!airplane) return;

    // Assume the tail is a child mesh of the airplane group
    // You might need to adjust 'Tail' based on the actual name in your FBX model
    const tail = airplane.getObjectByName('Tail');
    if (!tail) return;

    // Smoothly interpolate the tail's rotation towards the target rotation
    const lerpFactor = 0.1; // Adjust this value for slower or faster interpolation
    tail.rotation.z = THREE.MathUtils.lerp(tail.rotation.z, airplane.targetTailRotationZ, lerpFactor);
}