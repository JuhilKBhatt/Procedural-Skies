// ./main.js
import * as THREE from 'three';
import { generateTerrainChunk, CHUNK_SIZE, CHUNK_SEGMENTS } from './assets/scripts/worldGeneration.js';
import { createAirplane } from './assets/scripts/airplane.js';
import { ControlHandler } from './assets/scripts/controlHandler.js';
import * as CANNON from 'cannon-es';
import { getChunkKey, cleanMaterial, updateTerrainChunks } from './assets/scripts/Utility.js';
import { CameraHandler } from './assets/scripts/camera.js';
import { AudioHandler } from './assets/scripts/audioHandler.js';
import { GUI } from 'GUI';

// GUI settings
const worldGenSettings = {
    TERRAIN_MAX_HEIGHT: 80, 
    TERRAIN_MIN_HEIGHT: -40,
    NOISE_INPUT_SCALE: 0.007,
    regenerateWorld: async () => {}
};

const worldPopSettings = {
    CLUSTERS_PER_CHUNK: 1,
    OBJECTS_PER_CLUSTER: 5,
    CLOUDS_PER_CHUNK: 2,
    repopulateChunks: async () => {}
};

const gui = new GUI();

// HUD elements
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

// Initialise CameraHandler
const cameraHandler = new CameraHandler(renderer.domElement, {
    fov: 75,
    near: 0.1,
    far: CHUNK_SIZE * 20,
    initialChunkSize: CHUNK_SIZE,
    cameraOffset: new THREE.Vector3(0, 10, -30),
    lookAtOffset: new THREE.Vector3(0, 5, 0)
});
const camera = cameraHandler.getCamera();

// Physics world setup
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
let lastPhysicsUpdate = 0;
const fixedTimeStep = 1 / 60;
const MAX_SUBSTEPS = 10;

// GUI Setup
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

//World Regeneration
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
        try {
            const newChunkCoords = await updateTerrainChunks({
                airplane, activeChunks,
                currentLastPlayerChunkX: lastPlayerChunkX, currentLastPlayerChunkZ: lastPlayerChunkZ,
                scene, world, terrainMaterial, light, CHUNK_SIZE, VIEW_DISTANCE_CHUNKS,
                generateTerrainChunk,
                worldGenSettings, // Pass new settings
                worldPopSettings  // Pass new settings
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

// Repopulation Functions
worldPopSettings.repopulateChunks = async () => {
    console.log("Repopulating chunks with settings:", worldPopSettings);
    console.warn("Current 'Repopulate Chunks' triggers a full world regeneration. For optimized repopulation, further decoupling of populateChunk is needed.");
    await worldGenSettings.regenerateWorld(); // Uses the full regeneration logic
};

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

        // Ensure initial previous values are also set correctly
        airplane.physicsBody.previousPosition.copy(airplane.physicsBody.position);
        airplane.physicsBody.previousQuaternion.copy(airplane.physicsBody.quaternion); // <<< Keep this!

        scene.add(airplane);
        world.addBody(airplane.physicsBody);

        // Initial copy for the Three.js object from the physics body
        airplane.position.copy(airplane.physicsBody.position);
        airplane.quaternion.copy(airplane.physicsBody.quaternion); // <<< Ensure this copy happens

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
        console.log("Attempting initial chunk load...");
        updateTerrainChunks({
            airplane, activeChunks,
            currentLastPlayerChunkX: lastPlayerChunkX, currentLastPlayerChunkZ: lastPlayerChunkZ,
            scene, world, terrainMaterial, light, CHUNK_SIZE, VIEW_DISTANCE_CHUNKS,
            generateTerrainChunk,
            worldGenSettings, // Pass initial settings
            worldPopSettings  // Pass initial settings
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

// Handle First User Interaction for Audio
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
window.addEventListener('keydown', handleFirstInteractionForAudio, { capture: true });
window.addEventListener('mousedown', handleFirstInteractionForAudio, { capture: true });
window.addEventListener('touchstart', handleFirstInteractionForAudio, { capture: true }); // For touch devices

async function animate() {
    requestAnimationFrame(animate);
    const deltaTime = clock.getDelta();

    // Accumulate time to ensure physics steps are consistent
    lastPhysicsUpdate += deltaTime;
    let numSubsteps = 0;
    while (lastPhysicsUpdate >= fixedTimeStep && numSubsteps < MAX_SUBSTEPS) {
        world.step(fixedTimeStep);
        lastPhysicsUpdate -= fixedTimeStep;
        numSubsteps++;
    }

    // This handles the case where no physics steps occurred but rendering still happens
    const interpolationFactor = lastPhysicsUpdate / fixedTimeStep;

    if (controlHandler) {
        try {
            controlHandler.updateAirplane();
        } catch (error) {
            console.error("Error in controlHandler.update():", error);
        }
    }

    if (airplane && airplane.physicsBody) {
        // Interpolate position and quaternion for smooth rendering
        airplane.position.lerpVectors(airplane.physicsBody.previousPosition, airplane.physicsBody.position, interpolationFactor);

        // Create temporary quaternions for the previous and current physics state
        const prevQuat = new THREE.Quaternion(
            airplane.physicsBody.previousQuaternion.x,
            airplane.physicsBody.previousQuaternion.y,
            airplane.physicsBody.previousQuaternion.z,
            airplane.physicsBody.previousQuaternion.w
        );
        const currQuat = new THREE.Quaternion(
            airplane.physicsBody.quaternion.x,
            airplane.physicsBody.quaternion.y,
            airplane.physicsBody.quaternion.z,
            airplane.physicsBody.quaternion.w
        );

        // Perform SLERP into a temporary quaternion, then normalize and copy
        const interpolatedQuat = new THREE.Quaternion();
        interpolatedQuat.slerpQuaternions(prevQuat, currQuat, interpolationFactor);
        interpolatedQuat.normalize(); // Explicitly normalize the result

        // Apply the normalized, interpolated quaternion to the Three.js airplane object
        airplane.quaternion.copy(interpolatedQuat);

        if (typeof airplane.update === 'function') {
            try {
                airplane.update(deltaTime); // For visual-only updates on the airplane mesh
            } catch (error) {
                console.error("Error in airplane.update():", error);
            }
        }

        // HUD Elements
        if (airplane.flightPhysics) {
            // Throttle Update
            if (throttleValueElement && throttleBarElement) {
                const throttlePercentage = (airplane.flightPhysics.throttle || 0) * 100;
                throttleValueElement.textContent = throttlePercentage.toFixed(0);
                throttleBarElement.style.width = `${throttlePercentage}%`;
            }

            // Attitude Indicator Update
            if (attitudeIndicatorElement && aiGroundElement && aiRollIndicatorElement) {
                const euler = new THREE.Euler().setFromQuaternion(airplane.quaternion, 'YXZ');

                let pitch = euler.x;
                let roll = euler.z; 

                // Adjust pitch for the visual
                const pitchDegrees = THREE.MathUtils.radToDeg(pitch);
                const pitchTranslationPercentage = (pitchDegrees / 90) * 50;
                const clampedPitchTranslation = Math.max(-50, Math.min(50, pitchTranslationPercentage));

                // Roll
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