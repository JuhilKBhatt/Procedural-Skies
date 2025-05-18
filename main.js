import * as THREE from 'three';
import { OrbitControls } from 'https://unpkg.com/three@0.152.0/examples/jsm/controls/OrbitControls.js';
import { generateTerrain } from './assets/scripts/worldGeneration.js';
import { createAirplane } from './assets/scripts/airplane.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 200, 800);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000); // Increased far plane
const renderer = new THREE.WebGLRenderer({ antialias: true }); // Added antialias for smoother edges

// Enable Shadow Maps
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Softer shadows

renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// OrbitControls (optional, for debugging camera, can be disabled if fixed follow cam is preferred)
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.screenSpacePanning = false;
controls.minDistance = 10;
controls.maxDistance = 500;
controls.maxPolarAngle = Math.PI / 2; // Prevent camera from going below ground

// Lighting
const light = new THREE.DirectionalLight(0xffffff, 2.5); // Increased intensity
light.position.set(150, 300, 200); // Higher and angled for better shadows
light.castShadow = true; // Enable shadow casting for this light
scene.add(light);

// Configure shadow properties for the directional light
light.shadow.mapSize.width = 4096; // Higher resolution for sharper shadows
light.shadow.mapSize.height = 4096;
light.shadow.camera.near = 50;
light.shadow.camera.far = 1000;

// Adjust the shadow camera frustum to cover the terrain area effectively
const shadowCamSize = 350; // This should roughly match or exceed terrainSize / 2
light.shadow.camera.left = -shadowCamSize;
light.shadow.camera.right = shadowCamSize;
light.shadow.camera.top = shadowCamSize;
light.shadow.camera.bottom = -shadowCamSize;

const ambientLight = new THREE.AmbientLight(0x606080, 1.0); // Softer ambient light
scene.add(ambientLight);

// Terrain Generation
const terrain = generateTerrain(scene);

// Airplane (assuming createAirplane correctly positions the airplane and adds it to scene)
const airplane = createAirplane(scene);
// Ensure airplane casts shadows (you might need to do this in airplane.js)
airplane.traverse(node => {
    if (node.isMesh) {
     node.castShadow = true;
    }
});

// Keyboard control
window.addEventListener('keydown', (event) => {
  if (!airplane) return;
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
    if (!airplane) return;
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

// Initial camera position (will be updated by follow logic)
camera.position.set(0, -100, -60); // Adjusted for a better initial view

const cameraOffset = new THREE.Vector3(0, 180, -280); // Adjusted offset: Y higher, Z further back

function animate() {
    requestAnimationFrame(animate);
    controls.update(); // Required if enableDamping or autoRotate is true

    if (airplane) {
        airplane.updateSpeed(airplane.speed, 0);
        airplane.updatePosition();
        airplane.animateRudder();
        airplane.animateElevator();
        airplane.animateEngine();

        const airplanePosition = airplane.position.clone();
        const airplaneRotation = airplane.rotation.clone();

        // Ensure the camera follows from behind and slightly above
        const rotatedCameraOffset = cameraOffset.clone().applyEuler(new THREE.Euler(0, airplaneRotation.y, 0, 'XYZ'));
        const desiredCameraPosition = airplanePosition.clone().add(rotatedCameraOffset);

        const cameraLerpFactor = 0.07; // Smoother follow
        camera.position.lerp(desiredCameraPosition, cameraLerpFactor);
        camera.lookAt(airplanePosition.x, airplanePosition.y + 5, airplanePosition.z); // Look slightly above center mass
    }


    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});