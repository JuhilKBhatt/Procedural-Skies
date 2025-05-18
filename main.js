// main.js
import * as THREE from 'three';
import { OrbitControls } from 'https://unpkg.com/three@0.152.0/examples/jsm/controls/OrbitControls.js';
import { generateTerrain } from './assets/scripts/worldGeneration.js';
import { createAirplane } from './assets/scripts/airplane.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(50, 100, 50).normalize();
scene.add(light);

const ambientLight = new THREE.AmbientLight(0x404040, 2);
scene.add(ambientLight);

const terrain = generateTerrain(scene);
scene.add(terrain);

const airplane = createAirplane(scene);

// Keyboard control
window.addEventListener('keydown', (event) => {
  switch (event.key) {
    case 'ArrowUp':
      // Increase speed
      airplane.speed = Math.min(airplane.speed + 0.01, airplane.maxSpeed);
      // Set target elevator rotation for nose down (assuming positive x rotates elevator down)
      airplane.targetElevatorRotationX = 0.3; // Adjust value for desired rotation amount
      break;
    case 'ArrowDown':
      // Decrease speed
      airplane.speed = Math.max(airplane.speed - 0.01, 0);
      // Set target elevator rotation for nose up (assuming positive x rotates elevator down)
      airplane.targetElevatorRotationX = -0.3; // Adjust value for desired rotation amount
      break;
    case 'ArrowLeft':
      airplane.rotation.y += 0.05;
      // Set the target rudder rotation for left turn (assuming positive z rotates rudder left)
      airplane.targetRudderRotationZ = 0.5; // Adjust this value for desired left rotation amount
      break;
    case 'ArrowRight':
      airplane.rotation.y -= 0.05;
      // Set the target rudder rotation for right turn (assuming positive z rotates rudder right)
      airplane.targetRudderRotationZ = -0.5; // Adjust this value for desired right rotation amount
      break;
  }
});

window.addEventListener('keyup', (event) => {
    switch (event.key) {
        case 'ArrowUp':
        case 'ArrowDown':
            // Reset target elevator rotation when arrow keys are released
            airplane.targetElevatorRotationX = 0;
            break;
        case 'ArrowLeft':
        case 'ArrowRight':
            // Reset the target rudder rotation when arrow keys are released
            airplane.targetRudderRotationZ = 0;
            break;
    }
});


camera.position.set(0, 50, 50);

function animate() {
    requestAnimationFrame(animate);
    airplane.updatePosition();
    airplane.animateRudder(); // Call rudder animation
    airplane.animateElevator(); // Call elevator animation
    airplane.animateEngine(); // Call engine animation <--- Added

    controls.update();
    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});