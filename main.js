// main.js
import * as THREE from 'three';
import { OrbitControls } from 'https://unpkg.com/three@0.152.0/examples/jsm/controls/OrbitControls.js';
import { generateTerrainChunk } from './assets/scripts/worldGeneration.js'; // Updated import
import { createAirplane } from './assets/scripts/airplane.js';
import { ControlHandler } from './assets/scripts/controlHandler.js';
import * as CANNON from 'cannon-es';

const clock = new THREE.Clock();
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 500, 3000); // Adjusted fog for larger view distance

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 20000);
const renderer = new THREE.WebGLRenderer({ antialias: true });

// Cannon.js world
const world = new CANNON.World();
world.gravity.set(0, -9.82, 0); // Standard gravity
world.broadphase = new CANNON.SAPBroadphase(world);
world.solver.iterations = 10;

const airplaneMaterial = new CANNON.Material("airplaneMaterial");
const terrainMaterial = new CANNON.Material("terrainMaterial");

const airplaneTerrainContactMaterial = new CANNON.ContactMaterial(
    airplaneMaterial,
    terrainMaterial,
    {
        friction: 0.4,      // Slightly reduced friction
        restitution: 0.05,   // Very low bounciness
        contactEquationStiffness: 1e7,
        contactEquationRelaxation: 3, // Standard relaxation
        frictionEquationStiffness: 1e7,
        frictionEquationRelaxation: 3, // Standard relaxation
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
controls.maxDistance = 2000; // Increased max orbit distance

const light = new THREE.DirectionalLight(0xffffff, 5);
light.position.set(250, 400, 300); // Adjusted for potentially larger scenes
light.castShadow = true;
scene.add(light);

// Adjust shadow camera to cover a larger area if CHUNK_LOAD_RADIUS is large
light.shadow.mapSize.width = 4096;
light.shadow.mapSize.height = 4096;
light.shadow.camera.near = 50;
light.shadow.camera.far = 1500; // Needs to cover visible terrain
const shadowCamSize = 700; // Frustum size for shadow camera
light.shadow.camera.left = -shadowCamSize;
light.shadow.camera.right = shadowCamSize;
light.shadow.camera.top = shadowCamSize;
light.shadow.camera.bottom = -shadowCamSize;
// For debugging shadow camera:
// const shadowHelper = new THREE.CameraHelper(light.shadow.camera);
// scene.add(shadowHelper);

const ambientLight = new THREE.AmbientLight(0x707090, 1.5); // Slightly more ambient
scene.add(ambientLight);


// --- Terrain Chunk Management ---
const CHUNK_SIZE = 500;           // Width and depth of a terrain chunk
const CHUNK_SEGMENTS = 64;        // Number of segments per side for a chunk (resolution)
const TERRAIN_MAX_HEIGHT = 200;   // Max peak height
const TERRAIN_MIN_HEIGHT = -100;  // Min valley depth
const NOISE_INPUT_SCALE = 0.0025; // Scale for Perlin noise input (affects feature size)

const activeChunks = new Map();   // Stores active chunks: "x_z" -> chunkObject
const CHUNK_LOAD_RADIUS = 2;      // Load chunks in a (2*R+1)x(2*R+1) grid around player's current chunk
                                  // e.g., R=1 means a 3x3 grid. R=2 means 5x5.

function getChunkKey(chunkX, chunkZ) {
    return `${chunkX}_${chunkZ}`;
}

function updateTerrainChunks(playerPosition) {
    if (!airplane || !airplane.physicsBody) return;

    const playerChunkX = Math.round(playerPosition.x / CHUNK_SIZE);
    const playerChunkZ = Math.round(playerPosition.z / CHUNK_SIZE);

    // Load/activate necessary chunks
    for (let dx = -CHUNK_LOAD_RADIUS; dx <= CHUNK_LOAD_RADIUS; dx++) {
        for (let dz = -CHUNK_LOAD_RADIUS; dz <= CHUNK_LOAD_RADIUS; dz++) {
            const chunkX = playerChunkX + dx;
            const chunkZ = playerChunkZ + dz;
            const key = getChunkKey(chunkX, chunkZ);

            if (!activeChunks.has(key)) {
                // console.log(`Loading chunk: ${key}`);
                const newChunk = generateTerrainChunk(
                    scene, world, terrainMaterial,
                    chunkX, chunkZ, CHUNK_SIZE, CHUNK_SEGMENTS,
                    TERRAIN_MAX_HEIGHT, TERRAIN_MIN_HEIGHT, NOISE_INPUT_SCALE
                );
                activeChunks.set(key, newChunk);
            }
        }
    }

    // Unload distant chunks
    const keysToRemove = [];
    activeChunks.forEach((chunk, key) => {
        const distSq = (chunk.chunkX - playerChunkX)**2 + (chunk.chunkZ - playerChunkZ)**2;
        // Unload if outside a slightly larger radius than load radius to prevent rapid load/unload cycling
        if (Math.sqrt(distSq) > CHUNK_LOAD_RADIUS + 1.5) { // Using 1.5 as a buffer
            keysToRemove.push(key);
        }
    });

    keysToRemove.forEach(key => {
        const chunkToUnload = activeChunks.get(key);
        if (chunkToUnload) {
            // console.log(`Unloading chunk: ${key}`);
            chunkToUnload.dispose(); // Use the dispose method on the chunk object
            activeChunks.delete(key);
        }
    });
}

// Airplane setup
const airplane = createAirplane(scene, world);
if (airplane && airplane.physicsBody) {
    airplane.physicsBody.material = airplaneMaterial;
    // Start airplane higher to ensure it's above initial terrain
    airplane.physicsBody.position.set(0, TERRAIN_MAX_HEIGHT + 100, 0);
    airplane.position.copy(airplane.physicsBody.position); // Sync visual
}

airplane.traverse(node => {
    if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
    }
});

const controlHandler = new ControlHandler(airplane);

const cameraOffset = new THREE.Vector3(0, 12, -32); // Adjusted camera view
const lookAtOffset = new THREE.Vector3(0, 6, 0);

let useFollowCamera = true;
window.addEventListener('keydown', (e) => {
    if (e.key === 'c') {
        useFollowCamera = !useFollowCamera;
        controls.enabled = !useFollowCamera;
        if (!useFollowCamera && airplane) {
            controls.target.copy(airplane.position); // Aim orbit cam at airplane
            controls.update();
        }
    }
});

// Initial terrain generation around the starting point
if (airplane && airplane.physicsBody) {
    updateTerrainChunks(airplane.physicsBody.position);
} else {
    // Fallback if airplane isn't immediately available (shouldn't happen with current order)
    updateTerrainChunks(new CANNON.Vec3(0, 0, 0));
}

let lastTerrainUpdateTime = 0;
const TERRAIN_UPDATE_INTERVAL = 0.5; // Seconds - how often to check for new chunks

function animate() {
    requestAnimationFrame(animate);
    const deltaTime = clock.getDelta();
    const elapsedTime = clock.getElapsedTime();
    const fixedTimeStep = 1 / 60;

    // Step the physics world
    world.step(fixedTimeStep, deltaTime, 3); // Max sub-steps: 3

    if (airplane && airplane.physicsBody) {
        // Periodically update terrain chunks based on airplane's position
        if (elapsedTime - lastTerrainUpdateTime > TERRAIN_UPDATE_INTERVAL) {
            updateTerrainChunks(airplane.physicsBody.position);
            lastTerrainUpdateTime = elapsedTime;
        }

        if (useFollowCamera) {
            airplane.position.copy(airplane.physicsBody.position);
            airplane.quaternion.copy(airplane.physicsBody.quaternion);
            airplane.update(deltaTime); // Handles physics and visual animations

            const targetPosition = airplane.position.clone();
            const offset = cameraOffset.clone().applyQuaternion(airplane.quaternion);
            const desiredCameraPosition = targetPosition.clone().add(offset);

            const cameraLerpFactor = 0.08; // Smooth camera follow
            camera.position.lerp(desiredCameraPosition, cameraLerpFactor);

            const lookAtPosition = targetPosition.clone().add(lookAtOffset.clone().applyQuaternion(airplane.quaternion));
            camera.lookAt(lookAtPosition);
        } else {
            controls.update();
        }
    } else if (!useFollowCamera) { // If no airplane, but orbit controls are enabled
        controls.update();
    }


    renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Important: Ensure your createAirplane function in airplane.js
// does NOT rely on a global 'terrain' object for its initial Y position.
// The airplane is now positioned high up in main.js explicitly.