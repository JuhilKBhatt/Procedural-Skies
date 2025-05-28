// main.js
import * as THREE from 'three';
import { OrbitControls } from 'https://unpkg.com/three@0.152.0/examples/jsm/controls/OrbitControls.js';
import { generateTerrainChunk, CHUNK_SIZE, CHUNK_SEGMENTS } from './assets/scripts/worldGeneration.js';
import { createAirplane } from './assets/scripts/airplane.js';
import { ControlHandler } from './assets/scripts/controlHandler.js';
import * as CANNON from 'cannon-es';
import { getChunkKey, cleanMaterial, updateTerrainChunks } from './assets/scripts/Utility.js';
import { CameraHandler } from './assets/scripts/camera.js';
import { AudioHandler } from './assets/scripts/audioHandler.js';

const throttleValueElement = document.getElementById('throttle-value');
const throttleBarElement = document.getElementById('throttle-bar');
const attitudeIndicatorElement = document.getElementById('attitude-indicator');
const aiGroundElement = document.getElementById('ai-ground');
const aiRollIndicatorElement = document.getElementById('ai-roll-indicator'); // Get the roll indicator

const clock = new THREE.Clock();
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, CHUNK_SIZE * 2, CHUNK_SIZE * 8);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Initialize CameraHandler
const cameraHandler = new CameraHandler(renderer.domElement, {
    fov: 75,
    near: 0.1,
    far: CHUNK_SIZE * 20, // Use CHUNK_SIZE for dynamic far plane
    initialChunkSize: CHUNK_SIZE, // Pass CHUNK_SIZE for other internal settings
    cameraOffset: new THREE.Vector3(0, 10, -30), // Your original offset
    lookAtOffset: new THREE.Vector3(0, 5, 0)    // Your original lookAt offset
});
const camera = cameraHandler.getCamera(); // Get the camera instance for the scene and renderer

const world = new CANNON.World();
world.gravity.set(0, -4, 0); // Adjusted gravity
world.broadphase = new CANNON.SAPBroadphase(world);
world.solver.iterations = 10;

const airplaneMaterial = new CANNON.Material("airplaneMaterial");
const terrainMaterial = new CANNON.Material("terrainMaterial");

const airplaneTerrainContactMaterial = new CANNON.ContactMaterial(
    airplaneMaterial,
    terrainMaterial,
    {
        friction: 0.5,
        restitution: 0.1,
        contactEquationStiffness: 1e7,
        contactEquationRelaxation: 4,
        frictionEquationStiffness: 1e7,
        frictionEquationRelaxation: 4,
    }
);
world.addContactMaterial(airplaneTerrainContactMaterial);

const light = new THREE.DirectionalLight(0xffffff, 5);
light.position.set(CHUNK_SIZE * 0.75, CHUNK_SIZE * 1.5, CHUNK_SIZE);
light.castShadow = true;
scene.add(light);

light.shadow.mapSize.width = 4096;
light.shadow.mapSize.height = 4096;
light.shadow.camera.near = 50;
light.shadow.camera.far = CHUNK_SIZE * 4;
const shadowCamSize = CHUNK_SIZE * 1.5;
light.shadow.camera.left = -shadowCamSize;
light.shadow.camera.right = shadowCamSize;
light.shadow.camera.top = shadowCamSize;
light.shadow.camera.bottom = -shadowCamSize;

const ambientLight = new THREE.AmbientLight(0x606080, 1.5);
scene.add(ambientLight);

const activeChunks = new Map();
const VIEW_DISTANCE_CHUNKS = 2;
let lastPlayerChunkX = null;
let lastPlayerChunkZ = null;

let airplane;
let controlHandler;
let audioHandler;
let firstUserInteraction = false;

try {
    audioHandler = new AudioHandler('./assets/audio/engineLoop.mp3');
} catch (error) {
    console.error("Error creating AudioHandler instance:", error);
}

try {
    airplane = createAirplane(scene, world);
} catch (error) {
    console.error("Error during createAirplane():", error);
}

if (airplane) {
    console.log("Airplane object created:", airplane);
    if (airplane.physicsBody) {
        console.log("Airplane physicsBody exists.");
        airplane.physicsBody.material = airplaneMaterial;
        airplane.physicsBody.position.set(0, CHUNK_SIZE * 0.5, 0);
        airplane.physicsBody.wakeUp();
        airplane.position.copy(airplane.physicsBody.position);
        airplane.quaternion.copy(airplane.physicsBody.quaternion);
        cameraHandler.setTarget(airplane);
    } else {
        console.error("Airplane created, but airplane.physicsBody is missing!");
        airplane.position.set(0, CHUNK_SIZE * 0.5, 0);
    }

    airplane.traverse(node => {
        if (node.isMesh) {
            node.castShadow = true;
            node.receiveShadow = true;
        }
    });

    try {
        controlHandler = new ControlHandler(airplane);
    } catch (error) {
        console.error("Error during new ControlHandler():", error);
    }

    if (airplane.physicsBody) {
        console.log("Attempting initial chunk load (inside airplane check)...");
        updateTerrainChunks({ // Call the imported function
            airplane,
            activeChunks,
            currentLastPlayerChunkX: lastPlayerChunkX,
            currentLastPlayerChunkZ: lastPlayerChunkZ,
            scene,
            world,
            terrainMaterial,
            light,
            CHUNK_SIZE,
            VIEW_DISTANCE_CHUNKS,
            generateTerrainChunk // Pass the function
        }).then(newChunkCoords => {
            lastPlayerChunkX = newChunkCoords.lastPlayerChunkX;
            lastPlayerChunkZ = newChunkCoords.lastPlayerChunkZ;
        }).catch(error => console.error("Error during initial chunk load (inside airplane check):", error));
    } else {
        console.warn("Skipping initial chunk load because airplane.physicsBody is missing.");
        cameraHandler.setFallbackMode(new THREE.Vector3(0, CHUNK_SIZE * 0.25, 50));
    }

} else {
    console.error("Airplane object was NOT created. Cannot proceed with airplane-dependent setup.");
    cameraHandler.setFallbackMode(new THREE.Vector3(0, 50, 100));
}

// --- Handle First User Interaction for Audio ---
function handleFirstInteractionForAudio() {
    if (!firstUserInteraction && audioHandler) {
        console.log("First user interaction detected, attempting to resume audio context.");
        audioHandler.resumeContext(); // Attempt to resume the audio context
        firstUserInteraction = true;
        // Remove listeners after the first interaction
        window.removeEventListener('keydown', handleFirstInteractionForAudio, { capture: true });
        window.removeEventListener('mousedown', handleFirstInteractionForAudio, { capture: true });
        window.removeEventListener('touchstart', handleFirstInteractionForAudio, { capture: true });
    }
}

// Listen for various user interactions to resume audio context
// Using capture: true to catch the event early
window.addEventListener('keydown', handleFirstInteractionForAudio, { capture: true });
window.addEventListener('mousedown', handleFirstInteractionForAudio, { capture: true });
window.addEventListener('touchstart', handleFirstInteractionForAudio, { capture: true }); // For touch devices

async function animate() { // Make animate async if it directly awaits updateTerrainChunks
    requestAnimationFrame(animate);
    const deltaTime = clock.getDelta();
    const fixedTimeStep = 1 / 60;

    if (controlHandler) {
        try {
            controlHandler.updateAirplane();
        } catch (error) {
            console.error("Error in controlHandler.update():", error);
        }
    }

    world.step(fixedTimeStep, deltaTime, 3);

    if (airplane && airplane.physicsBody) {
        airplane.position.copy(airplane.physicsBody.position);
        airplane.quaternion.copy(airplane.physicsBody.quaternion);

        if (typeof airplane.update === 'function') {
            try {
                airplane.update(deltaTime);
            } catch (error) {
                console.error("Error in airplane.update():", error);
            }
        }

        // --- Update UI Elements ---
        if (airplane.flightPhysics) {
            // Throttle Update
            if (throttleValueElement && throttleBarElement) {
                const throttlePercentage = (airplane.flightPhysics.throttle || 0) * 100;
                throttleValueElement.textContent = throttlePercentage.toFixed(0);
                throttleBarElement.style.width = `${throttlePercentage}%`;
            }

            // Attitude Indicator Update
            if (attitudeIndicatorElement && aiGroundElement && aiRollIndicatorElement) {
                // Get Euler angles from the airplane's quaternion
                const euler = new THREE.Euler().setFromQuaternion(airplane.quaternion, 'YXZ'); // Common order for airplanes

                let pitch = euler.x; // Radians
                let roll = euler.z;  // Radians

                const pitchDegrees = THREE.MathUtils.radToDeg(pitch);
                const pitchTranslationPercentage = (pitchDegrees / 90) * 50; // Max 50% translation
                const clampedPitchTranslation = Math.max(-50, Math.min(50, pitchTranslationPercentage));

                // Roll: Rotate the ground element. Negative roll in THREE.js (left wing down) means positive CSS rotation.
                const rollDegrees = THREE.MathUtils.radToDeg(roll);

                // Apply transformations
                aiGroundElement.style.transform = `translateY(${clampedPitchTranslation}%) rotate(${-rollDegrees}deg)`;
                aiRollIndicatorElement.style.transform = `translate(-50%, -50%) rotate(${-rollDegrees}deg)`;
            }
        }

        if (audioHandler && airplane.flightPhysics && typeof audioHandler.updateThrottleSound === 'function') {
            try {
                // Pass the actual throttle value from your airplane's flight physics
                audioHandler.updateThrottleSound(airplane.flightPhysics.throttle);
            } catch (error) {
                console.error("Error in audioHandler.updateThrottleSound():", error);
            }
        }

        // Call the imported function and update lastPlayerChunkX/Z
        try {
            const newChunkCoords = await updateTerrainChunks({
                airplane,
                activeChunks,
                currentLastPlayerChunkX: lastPlayerChunkX,
                currentLastPlayerChunkZ: lastPlayerChunkZ,
                scene,
                world,
                terrainMaterial,
                light,
                CHUNK_SIZE,
                VIEW_DISTANCE_CHUNKS,
                generateTerrainChunk
            });
            lastPlayerChunkX = newChunkCoords.lastPlayerChunkX;
            lastPlayerChunkZ = newChunkCoords.lastPlayerChunkZ;
        } catch (error) {
            console.error("Error during chunk update in animate:", error)
        }

        light.position.set(
            airplane.position.x + CHUNK_SIZE * 0.5,
            airplane.position.y + CHUNK_SIZE,
            airplane.position.z + CHUNK_SIZE * 0.5
        );
        light.target = airplane;
    }

    cameraHandler.update(deltaTime);

    try {
        renderer.render(scene, camera);
    } catch (error) {
        console.error("Error during renderer.render():", error);
    }
}

if (renderer && scene && camera) {
    console.log("Starting animation loop.");
    animate();
} else {
    console.error("Renderer, Scene or Camera not initialized. Cannot start animation.");
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});