// main.js
import * as THREE from 'three';
import { OrbitControls } from 'https://unpkg.com/three@0.152.0/examples/jsm/controls/OrbitControls.js';
import { generateTerrain } from './assets/scripts/worldGeneration.js';
import { createAirplane } from './assets/scripts/airplane.js';
import { ControlHandler } from './assets/scripts/controlHandler.js';
import * as CANNON from 'cannon-es';

const clock = new THREE.Clock();
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 200, 800);

const camera = new THREE.PerspectiveCamera(20, window.innerWidth / window.innerHeight, 100, 10000); // Increased far plane
const renderer = new THREE.WebGLRenderer({ antialias: true }); // Added antialias for smoother edges

// Cannon.js world
const world = new CANNON.World();
world.gravity.set(0, -9.8 * 10, 0); // Set gravity (same scaling as your flight physics)
world.broadphase = new CANNON.NaiveBroadphase(); // Basic broadphase collision detection
world.solver.iterations = 1; // Number of solver iterations for stability

// Create contact material for airplane and terrain
const airplaneTerrainContactMaterial = new CANNON.ContactMaterial(
    new CANNON.Material({ friction: 0.3, restitution: 0.0 }), // Airplane material properties
    new CANNON.Material({ friction: 0.3, restitution: 0.0 }), // Terrain material properties
    {
        friction: 0.6, // Coefficient of friction
        restitution: 0.0, // Coefficient of restitution (bounciness)
        contactEquationStiffness: 1e7,
        contactEquationRelaxation: 3,
        frictionEquationStiffness: 1e7,
        frictionEquationRelaxation: 3,
    }
);

// Add contact material to the world
world.addContactMaterial(airplaneTerrainContactMaterial);

// Enable Shadow Maps
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Softer shadows

renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// OrbitControls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.screenSpacePanning = false;
controls.minDistance = 10;
controls.maxDistance = 500;

// Lighting
const light = new THREE.DirectionalLight(0xffffff, 5); // Increased intensity
light.position.set(150, 300, 200); // Higher and angled for better shadows
light.castShadow = true; // Enable shadow casting for this light
scene.add(light);

// Configure shadow properties for the directional light
light.shadow.mapSize.width = 4096;
light.shadow.mapSize.height = 4096;
light.shadow.camera.near = 50;
light.shadow.camera.far = 1000;

// Adjust the shadow camera frustum to cover the terrain area effectively
const shadowCamSize = 350;
light.shadow.camera.left = -shadowCamSize;
light.shadow.camera.right = shadowCamSize;
light.shadow.camera.top = shadowCamSize;
light.shadow.camera.bottom = -shadowCamSize;

const ambientLight = new THREE.AmbientLight(0x606080, 1.0); // Softer ambient light
scene.add(ambientLight);

// Terrain Generation
const terrain = generateTerrain(scene, world);

// Airplane (assuming createAirplane correctly positions the airplane and adds it to scene)
const airplane = createAirplane(scene, world);
// Ensure airplane casts shadows (you might need to do this in airplane.js)
airplane.traverse(node => {
    if (node.isMesh) {
     node.castShadow = true;
    }
});

// Control Handler
const controlHandler = new ControlHandler(airplane);

// Initial camera position
const cameraOffset = new THREE.Vector3(0, 180, -425);

function animate() {
    requestAnimationFrame(animate);
    controls.update();

    const deltaTime = clock.getDelta();
    world.step(1 / 60, deltaTime, 10);

    if (airplane) {

        airplane.update(deltaTime); // Your existing airplane update logic

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
        camera.lookAt(airplanePosition.x, airplanePosition.y, airplanePosition.z); // Look slightly above center mass
    }

    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});