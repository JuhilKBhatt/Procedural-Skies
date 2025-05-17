import * as THREE from 'three';
import { OrbitControls } from 'https://unpkg.com/three@0.152.0/examples/jsm/controls/OrbitControls.js';
import { generateTerrain } from './assets/scripts/worldGeneration.js';
import { loadAirplane, updateAirplane, updateCameraPosition } from './assets/scripts/airplane.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// OrbitControls setup
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

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
let input = { forward: false, left: false, right: false };
loadAirplane(scene, camera);

// Event listeners for movement
window.addEventListener('keydown', (event) => {
    if (event.key === 'w') input.forward = true;
    if (event.key === 'a') input.left = true;
    if (event.key === 'd') input.right = true;
});
window.addEventListener('keyup', (event) => {
    if (event.key === 'w') input.forward = false;
    if (event.key === 'a') input.left = false;
    if (event.key === 'd') input.right = false;
});

function animate() {
    requestAnimationFrame(animate);
    const deltaTime = 0.016; // Approximate frame time (60 FPS)
    updateAirplane(deltaTime, input);
    updateCameraPosition(camera);
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