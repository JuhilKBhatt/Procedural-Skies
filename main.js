// main.js
import * as THREE from 'three';
import { OrbitControls } from 'https://unpkg.com/three@0.152.0/examples/jsm/controls/OrbitControls.js';
import { generateTerrain } from './assets/scripts/worldGeneration.js'; // Assuming this file exists
import { createAirplane } from './assets/scripts/airplane.js';
import { ControlHandler } from './assets/scripts/controlHandler.js';
import * as CANNON from 'cannon-es';

const clock = new THREE.Clock();
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 200, 800);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000); // Adjusted near plane, common FOV
const renderer = new THREE.WebGLRenderer({ antialias: true });

// Cannon.js world
const world = new CANNON.World();
world.gravity.set(0, -9.82, 0); // Slightly increased gravity effect for gameplay if desired, or use 9.82 for real scale. Multiplier was 10, which is very high.
world.broadphase = new CANNON.SAPBroadphase(world); // SAPBroadphase is generally better than NaiveBroadphase
world.solver.iterations = 10; // More iterations for better stability

// Create contact material for airplane and terrain
// Give materials names for easier debugging if needed
const airplaneMaterial = new CANNON.Material("airplaneMaterial");
const terrainMaterial = new CANNON.Material("terrainMaterial");

const airplaneTerrainContactMaterial = new CANNON.ContactMaterial(
    airplaneMaterial,
    terrainMaterial,
    {
        friction: 0,      // Friction between airplane and terrain
        restitution: 0.1,   // Bounciness (low for crashes)
        contactEquationStiffness: 1e7,
        contactEquationRelaxation: 4, // Adjusted relaxation
        frictionEquationStiffness: 1e7,
        frictionEquationRelaxation: 4, // Adjusted relaxation
    }
);
world.addContactMaterial(airplaneTerrainContactMaterial);

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.screenSpacePanning = false;
controls.minDistance = 10;
controls.maxDistance = 500; // Max distance for orbit controls

const light = new THREE.DirectionalLight(0xffffff, 5);
light.position.set(150, 300, 200);
light.castShadow = true;
scene.add(light);

light.shadow.mapSize.width = 4096;
light.shadow.mapSize.height = 4096;
light.shadow.camera.near = 50;
light.shadow.camera.far = 1000;
const shadowCamSize = 350;
light.shadow.camera.left = -shadowCamSize;
light.shadow.camera.right = shadowCamSize;
light.shadow.camera.top = shadowCamSize;
light.shadow.camera.bottom = -shadowCamSize;

const ambientLight = new THREE.AmbientLight(0x606080, 1.5); // Slightly increased ambient
scene.add(ambientLight);

const terrain = generateTerrain(scene, world, terrainMaterial); // Pass terrainMaterial

const airplane = createAirplane(scene, world);
if (airplane && airplane.physicsBody) {
    airplane.physicsBody.material = airplaneMaterial; // Assign material to airplane physics body
}

airplane.traverse(node => {
    if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true; // Airplane parts can receive shadows from other parts
    }
});

const controlHandler = new ControlHandler(airplane);

const cameraOffset = new THREE.Vector3(0, 10, -30); // Camera closer and slightly lower behind perspective
const lookAtOffset = new THREE.Vector3(0, 5, 0);   // Look slightly above airplane's center for better view

let useFollowCamera = true;
window.addEventListener('keydown', (e) => {
    if (e.key === 'c') {
        useFollowCamera = !useFollowCamera;
        controls.enabled = !useFollowCamera;
    }
});

function animate() {
    requestAnimationFrame(animate);
    const deltaTime = clock.getDelta();
    const fixedTimeStep = 1 / 60; // Use a fixed timestep for physics

    // Step the physics world
    world.step(fixedTimeStep, deltaTime, 3); // Max sub-steps: 3

    if (useFollowCamera) {
        if (airplane && airplane.physicsBody) {
            // Sync Three.js airplane visual model with the Cannon.js physics body
            airplane.position.copy(airplane.physicsBody.position);
            airplane.quaternion.copy(airplane.physicsBody.quaternion);

            // Call airplane's internal update (which now calls flightPhysics.update)
            airplane.update(deltaTime); // This handles physics and visual animations

            // Camera follow logic
            const targetPosition = airplane.position.clone();
            const offset = cameraOffset.clone().applyQuaternion(airplane.quaternion); // Apply airplane's rotation to offset
            const desiredCameraPosition = targetPosition.clone().add(offset);

            const cameraLerpFactor = 0.07;
            camera.position.lerp(desiredCameraPosition, cameraLerpFactor);

            const lookAtPosition = targetPosition.clone().add(lookAtOffset.clone().applyQuaternion(airplane.quaternion));
            camera.lookAt(lookAtPosition);
        }
    } else {
        controls.update(); // only update when not in follow mode
    }

    renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});