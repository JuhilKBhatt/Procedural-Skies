// airplaneAnimate.js
import * as THREE from 'three';

export function animateAirplaneTail(airplane) {
    if (!airplane) return;

    // Assume the tail is a child mesh of the airplane group
    const tail = airplane.getObjectByName('Tail');
    if (!tail) return;

    // Tail animation parameters
    const tailSwingSpeed = 0.05;
    const tailSwingAmount = 0.2;
    const time = Date.now() * 0.001;

    // Oscillate the tail slightly to mimic movement
    tail.rotation.z = Math.sin(time * tailSwingSpeed) * tailSwingAmount;
}