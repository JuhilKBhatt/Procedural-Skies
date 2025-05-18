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
      airplane.speed = Math.min(airplane.speed + 0.01, airplane.maxSpeed);
      airplane.targetElevatorRotationX = 0.05;
      break;
    case 'ArrowDown':
      airplane.speed = Math.max(airplane.speed - 0.01, 0);
      airplane.targetElevatorRotationX = -0.05;
      break;
    case 'ArrowLeft':
      airplane.rotation.y += 0.05;
      airplane.targetRudderRotationZ = 0.5;
      break;
    case 'ArrowRight':
      airplane.rotation.y -= 0.05;
      airplane.targetRudderRotationZ = -0.5;
      break;
  }
});

window.addEventListener('keyup', (event) => {
    switch (event.key) {
        case 'ArrowUp':
        case 'ArrowDown':
            airplane.targetElevatorRotationX = 0;
            break;
        case 'ArrowLeft':
        case 'ArrowRight':
            airplane.targetRudderRotationZ = 0;
            break;
    }
});

// Initial camera position - this will be overwritten in the animate loop
camera.position.set(0, 50, 50);

const cameraOffset = new THREE.Vector3(0, 5, -10);

function animate() {
    requestAnimationFrame(animate);

    airplane.updateSpeed(airplane.speed, 0);
    airplane.updatePosition();
    airplane.animateRudder();
    airplane.animateElevator();
    airplane.animateEngine();

    // Get the airplane's current world position and rotation
    const airplanePosition = airplane.position;
    const airplaneRotation = airplane.rotation;

    // Calculate the desired camera position based on the airplane's position and the offset
    // We need to apply the airplane's rotation to the camera offset
    const rotatedCameraOffset = cameraOffset.clone().applyEuler(new THREE.Euler(0, airplaneRotation.y, 0, 'XYZ'));
    const desiredCameraPosition = airplanePosition.clone().add(rotatedCameraOffset);

    // Smoothly move the camera towards the desired position
    const cameraLerpFactor = 0.05;
    camera.position.lerp(desiredCameraPosition, cameraLerpFactor);

    // Make the camera look at the airplane
    camera.lookAt(airplanePosition);

    controls.update();
    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});