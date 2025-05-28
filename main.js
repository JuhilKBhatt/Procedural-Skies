// main.js
import * as THREE from 'three';
import { generateTerrainChunk, CHUNK_SIZE, CHUNK_SEGMENTS } from './assets/scripts/worldGeneration.js';
import { createAirplane } from './assets/scripts/airplane.js';
import { ControlHandler } from './assets/scripts/controlHandler.js';
import * as CANNON from 'cannon-es';
import { getChunkKey, cleanMaterial, updateTerrainChunks } from './assets/scripts/Utility.js';
import { CameraHandler } from './assets/scripts/camera.js';
import { AudioHandler } from './assets/scripts/audioHandler.js';
import { GUI } from 'GUI';

// --- GUI Settings Objects ---
const worldGenSettings = {
    TERRAIN_MAX_HEIGHT: 80,
    TERRAIN_MIN_HEIGHT: -40,
    NOISE_INPUT_SCALE: 0.007,
    regenerateWorld: async () => { /* Implementation below */ }
};

const worldPopSettings = {
    CLUSTERS_PER_CHUNK: 1,
    OBJECTS_PER_CLUSTER: 5,
    CLOUDS_PER_CHUNK: 2,
    repopulateChunks: async () => { /* Implementation below */ }
};

const gui = new GUI();

const throttleValueElement = document.getElementById('throttle-value');
const throttleBarElement = document.getElementById('throttle-bar');
const attitudeIndicatorElement = document.getElementById('attitude-indicator');
const aiGroundElement = document.getElementById('ai-ground');
const aiRollIndicatorElement = document.getElementById('ai-roll-indicator');

const clock = new THREE.Clock();
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const cameraHandler = new CameraHandler(renderer.domElement, {
    fov: 75,
    near: 0.1,
    far: CHUNK_SIZE * 20,
    initialChunkSize: CHUNK_SIZE,
    cameraOffset: new THREE.Vector3(0, 10, -30),
    lookAtOffset: new THREE.Vector3(0, 5, 0)
});
const camera = cameraHandler.getCamera();

const world = new CANNON.World();
world.gravity.set(0, -4, 0);
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

// --- GUI Setup ---
const worldGenFolder = gui.addFolder('World Generation');
worldGenFolder.add(worldGenSettings, 'TERRAIN_MAX_HEIGHT', 30, 300, 1).name('Max Height');
worldGenFolder.add(worldGenSettings, 'TERRAIN_MIN_HEIGHT', -150, 0, 1).name('Min Height');
worldGenFolder.add(worldGenSettings, 'NOISE_INPUT_SCALE', 0.0005, 0.03, 0.0001).name('Noise Scale');
worldGenFolder.add(worldGenSettings, 'regenerateWorld').name('Regenerate World');
worldGenFolder.open();

const worldPopFolder = gui.addFolder('World Population');
worldPopFolder.add(worldPopSettings, 'CLUSTERS_PER_CHUNK', 0, 10, 1).name('Terrain Clusters/Chunk');
worldPopFolder.add(worldPopSettings, 'OBJECTS_PER_CLUSTER', 0, 20, 1).name('Objects/Cluster');
worldPopFolder.add(worldPopSettings, 'CLOUDS_PER_CHUNK', 0, 10, 1).name('Clouds/Chunk');
worldPopFolder.add(worldPopSettings, 'repopulateChunks').name('Repopulate Chunks');
worldPopFolder.open();

// --- World Regeneration and Repopulation Functions ---
worldGenSettings.regenerateWorld = async () => {
    console.log("Regenerating world with settings:", worldGenSettings);
    for (const [key, chunkData] of activeChunks) {
        scene.remove(chunkData.mesh);
        if (chunkData.mesh.geometry) chunkData.mesh.geometry.dispose();
        if (chunkData.mesh.material) cleanMaterial(chunkData.mesh.material);
        if (chunkData.body) world.removeBody(chunkData.body);
        if (chunkData.populatedObjects) {
            chunkData.populatedObjects.forEach(obj => {
                scene.remove(obj);
                obj.traverse(child => {
                    if (child.isMesh) {
                        if (child.geometry) child.geometry.dispose();
                        if (child.material) cleanMaterial(child.material);
                    }
                });
            });
        }
        activeChunks.delete(key);
    }
    console.log("Cleared all active chunks.");
    lastPlayerChunkX = null;
    lastPlayerChunkZ = null;

    if (airplane && airplane.physicsBody) {
        console.log("Forcing terrain chunk update after regeneration...");

        previousAirplanePhysicsPosition.copy(airplane.physicsBody.position);
        previousAirplanePhysicsQuaternion.copy(airplane.physicsBody.quaternion);

        try {
            const newChunkCoords = await updateTerrainChunks({
                airplane, activeChunks,
                currentLastPlayerChunkX: lastPlayerChunkX, currentLastPlayerChunkZ: lastPlayerChunkZ,
                scene, world, terrainMaterial, light, CHUNK_SIZE, VIEW_DISTANCE_CHUNKS,
                generateTerrainChunk,
                worldGenSettings,
                worldPopSettings
            });
            lastPlayerChunkX = newChunkCoords.lastPlayerChunkX;
            lastPlayerChunkZ = newChunkCoords.lastPlayerChunkZ;
            console.log("World regeneration complete.");
        } catch (error) {
            console.error("Error during forced chunk update for regeneration:", error);
        }
    } else {
        console.warn("Airplane not ready, cannot trigger chunk regeneration.");
    }
};

worldPopSettings.repopulateChunks = async () => {
    console.log("Repopulating chunks with settings:", worldPopSettings);
    console.warn("Current 'Repopulate Chunks' triggers a full world regeneration. For optimized repopulation, further decoupling of populateChunk is needed.");
    await worldGenSettings.regenerateWorld();
};

try {
    audioHandler = new AudioHandler('./assets/audio/engineLoop.mp3');
} catch (error) {
    console.error("Error creating AudioHandler instance:", error);
}

// For physics interpolation
const physicsFixedTimeStep = 1 / 60; // Run physics at 60Hz
let physicsAccumulator = 0;
let previousAirplanePhysicsPosition = new THREE.Vector3();
let previousAirplanePhysicsQuaternion = new THREE.Quaternion();

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
        airplane.physicsBody.wakeUp(); // Ensure the body is active

        // Initialize previous physics state for interpolation
        previousAirplanePhysicsPosition.copy(airplane.physicsBody.position);
        previousAirplanePhysicsQuaternion.copy(airplane.physicsBody.quaternion);

        // Sync visual mesh to physics body initially
        airplane.position.copy(airplane.physicsBody.position);
        airplane.quaternion.copy(airplane.physicsBody.quaternion);

        cameraHandler.setTarget(airplane);
    } else {
        console.error("Airplane created, but airplane.physicsBody is missing!");
        airplane.position.set(0, CHUNK_SIZE * 0.5, 0); // Fallback if no physics
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
        console.log("Attempting initial chunk load...");
        updateTerrainChunks({
            airplane, activeChunks,
            currentLastPlayerChunkX: lastPlayerChunkX, currentLastPlayerChunkZ: lastPlayerChunkZ,
            scene, world, terrainMaterial, light, CHUNK_SIZE, VIEW_DISTANCE_CHUNKS,
            generateTerrainChunk,
            worldGenSettings,
            worldPopSettings
        }).then(newChunkCoords => {
            lastPlayerChunkX = newChunkCoords.lastPlayerChunkX;
            lastPlayerChunkZ = newChunkCoords.lastPlayerChunkZ;
        }).catch(error => console.error("Error during initial chunk load:", error));
    } else {
        console.warn("Skipping initial chunk load because airplane.physicsBody is missing.");
        cameraHandler.setFallbackMode(new THREE.Vector3(0, CHUNK_SIZE * 0.25, 50));
    }

} else {
    console.error("Airplane object was NOT created. Cannot proceed with airplane-dependent setup.");
    cameraHandler.setFallbackMode(new THREE.Vector3(0, 50, 100));
}

function handleFirstInteractionForAudio() {
    if (!firstUserInteraction && audioHandler) {
        console.log("First user interaction detected, attempting to resume audio context.");
        audioHandler.resumeContext();
        firstUserInteraction = true;
        window.removeEventListener('keydown', handleFirstInteractionForAudio, { capture: true });
        window.removeEventListener('mousedown', handleFirstInteractionForAudio, { capture: true });
        window.removeEventListener('touchstart', handleFirstInteractionForAudio, { capture: true });
    }
}

window.addEventListener('keydown', handleFirstInteractionForAudio, { capture: true });
window.addEventListener('mousedown', handleFirstInteractionForAudio, { capture: true });
window.addEventListener('touchstart', handleFirstInteractionForAudio, { capture: true });

async function animate() {
    requestAnimationFrame(animate);
    const deltaTime = clock.getDelta();

    if (controlHandler) {
        try {
            controlHandler.updateAirplane(); // Apply controls to affect physics for the next step
        } catch (error) {
            console.error("Error in controlHandler.updateAirplane():", error);
        }
    }

    if (airplane && airplane.physicsBody) {
        physicsAccumulator += deltaTime;

        // Fixed timestep for physics
        while (physicsAccumulator >= physicsFixedTimeStep) {
            // Store the state *before* the physics step for interpolation
            previousAirplanePhysicsPosition.copy(airplane.physicsBody.position);
            previousAirplanePhysicsQuaternion.copy(airplane.physicsBody.quaternion);

            // Step the physics world
            world.step(physicsFixedTimeStep);

            // Update airplane's internal logic (e.g., custom flight model adjustments after physics)
            if (typeof airplane.update === 'function') {
                try {
                    airplane.update(physicsFixedTimeStep); // Pass fixed step for consistent updates
                } catch (error) {
                    console.error("Error in airplane.update():", error);
                }
            }
            physicsAccumulator -= physicsFixedTimeStep;
        }

        // Calculate alpha for interpolation
        const alpha = physicsAccumulator / physicsFixedTimeStep;

        // Interpolate the visual representation (THREE.js mesh)
        airplane.position.lerpVectors(previousAirplanePhysicsPosition, airplane.physicsBody.position, alpha);
        // For quaternion slerp, it's good to clone the 'from' quaternion if it's the same object instance you are slerping to.
        // Here, previousAirplanePhysicsQuaternion is distinct from airplane.physicsBody.quaternion.
        airplane.quaternion.copy(previousAirplanePhysicsQuaternion).slerp(airplane.physicsBody.quaternion, alpha);


        // --- Update UI Elements --- (Usually based on the "true" physics state)
        if (airplane.flightPhysics) {
            if (throttleValueElement && throttleBarElement) {
                const throttlePercentage = (airplane.flightPhysics.throttle || 0) * 100;
                throttleValueElement.textContent = throttlePercentage.toFixed(0);
                throttleBarElement.style.width = `${throttlePercentage}%`;
            }
            if (attitudeIndicatorElement && aiGroundElement && aiRollIndicatorElement) {
                const euler = new THREE.Euler().setFromQuaternion(airplane.physicsBody.quaternion, 'YXZ'); // Use current physics state for UI
                let pitch = euler.x;
                let roll = euler.z;
                const pitchDegrees = THREE.MathUtils.radToDeg(pitch);
                const pitchTranslationPercentage = (pitchDegrees / 90) * 50;
                const clampedPitchTranslation = Math.max(-50, Math.min(50, pitchTranslationPercentage));
                const rollDegrees = THREE.MathUtils.radToDeg(roll);
                aiGroundElement.style.transform = `translateY(${clampedPitchTranslation}%) rotate(${-rollDegrees}deg)`;
                aiRollIndicatorElement.style.transform = `translate(-50%, -50%) rotate(${-rollDegrees}deg)`;
            }
        }

        if (audioHandler && airplane.flightPhysics && typeof audioHandler.updateThrottleSound === 'function') {
            try {
                audioHandler.updateThrottleSound(airplane.flightPhysics.throttle);
            } catch (error) {
                console.error("Error in audioHandler.updateThrottleSound():", error);
            }
        }

        // Update terrain chunks
        // Note: airplane.position used by updateTerrainChunks will be the interpolated one.
        // If it needs the physics position, it should access airplane.physicsBody.position directly.
        try {
            const newChunkCoords = await updateTerrainChunks({
                airplane, activeChunks,
                currentLastPlayerChunkX: lastPlayerChunkX, currentLastPlayerChunkZ: lastPlayerChunkZ,
                scene, world, terrainMaterial, light, CHUNK_SIZE, VIEW_DISTANCE_CHUNKS,
                generateTerrainChunk,
                worldGenSettings,
                worldPopSettings
            });
            lastPlayerChunkX = newChunkCoords.lastPlayerChunkX;
            lastPlayerChunkZ = newChunkCoords.lastPlayerChunkZ;
        } catch (error) {
            console.error("Error during chunk update in animate:", error);
        }

        // Light follows the interpolated visual position of the airplane
        light.position.set(
            airplane.position.x + CHUNK_SIZE * 0.5,
            airplane.position.y + CHUNK_SIZE,
            airplane.position.z + CHUNK_SIZE * 0.5
        );
        light.target = airplane; // light will use the interpolated airplane.position
    }

    cameraHandler.update(deltaTime); // Camera updates based on its target (the interpolated airplane)

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
    if (camera && renderer) { // Ensure camera and renderer are initialized
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }
});