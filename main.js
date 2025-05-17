import * as THREE from 'three';
import { OrbitControls } from 'https://unpkg.com/three@0.152.0/examples/jsm/controls/OrbitControls.js';
import { generateTerrain } from './assets/scripts/worldGeneration.js';
import { createAirplane, updateAirplane, getAirplane } from './airplane.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// OrbitControls setup (can be disabled if needed)
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enabled = false; // Disable manual control for third-person view

// Lighting
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(50, 100, 50).normalize();
scene.add(light);
const ambientLight = new THREE.AmbientLight(0x404040, 2); // Soft white light
scene.add(ambientLight);

// Terrain
const terrain = generateTerrain(scene);
scene.add(terrain);

// Airplane
let airplane;
createAirplane(scene, (loadedAirplane) => {
    airplane = loadedAirplane;
    // Initial camera position behind the airplane
    camera.position.set(0, 5, 15);
    camera.lookAt(airplane.position);
});

function animate() {
    requestAnimationFrame(animate);

    const deltaTime = 0.016; // Approximate frame time (60 FPS)

    // Update airplane position
    updateAirplane(deltaTime);

    // Update camera position to follow the airplane
    if (airplane) {
        const offset = new THREE.Vector3(0, 5, 15); // Camera offset behind the airplane
        offset.applyQuaternion(airplane.quaternion); // Match the airplane's rotation
        camera.position.copy(airplane.position).add(offset);
        camera.lookAt(airplane.position);
    }

    controls.update();
    renderer.render(scene, camera);
}
animate();

// Resize handler
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});