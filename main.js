// main.js (Partial - focus on airplane initialization and related logic)
import * as THREE from 'three';
import { OrbitControls } from 'https://unpkg.com/three@0.152.0/examples/jsm/controls/OrbitControls.js';
import { generateTerrainChunk, CHUNK_SIZE, CHUNK_SEGMENTS } from './assets/scripts/worldGeneration.js';
import { createAirplane } from './assets/scripts/airplane.js'; // Make sure this file/function is working
import { ControlHandler } from './assets/scripts/controlHandler.js'; // Make sure this file/class is working
import * as CANNON from 'cannon-es';

const clock = new THREE.Clock();
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, CHUNK_SIZE * 2, CHUNK_SIZE * 8);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, CHUNK_SIZE * 20);
const renderer = new THREE.WebGLRenderer({ antialias: true });

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

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.screenSpacePanning = false;
controls.minDistance = 10;
controls.maxDistance = 1000;

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

function getChunkKey(chunkX, chunkZ) {
    return `${chunkX},${chunkZ}`;
}

// Helper function to dispose of materials and textures (add this in main.js)
function cleanMaterial(material) {
    material.dispose();
    for (const key of Object.keys(material)) {
        const value = material[key];
        if (value && typeof value === 'object' && value.isTexture) {
            value.dispose();
        }
    }
}


// Modify updateTerrainChunks to be async if generateTerrainChunk is async
async function updateTerrainChunks() { // Added async
    if (!airplane || !airplane.physicsBody || !airplane.physicsBody.position) {
        return;
    }

    const playerX = airplane.physicsBody.position.x;
    const playerZ = airplane.physicsBody.position.z;

    const currentChunkX = Math.floor(playerX / CHUNK_SIZE);
    const currentChunkZ = Math.floor(playerZ / CHUNK_SIZE);

    if (currentChunkX === lastPlayerChunkX && currentChunkZ === lastPlayerChunkZ && activeChunks.size > 0) {
        return;
    }

    lastPlayerChunkX = currentChunkX;
    lastPlayerChunkZ = currentChunkZ;

    const chunksToKeep = new Set();
    const loadPromises = []; // To load chunks in parallel if desired

    for (let i = -VIEW_DISTANCE_CHUNKS; i <= VIEW_DISTANCE_CHUNKS; i++) {
        for (let j = -VIEW_DISTANCE_CHUNKS; j <= VIEW_DISTANCE_CHUNKS; j++) {
            const chunkX = currentChunkX + i;
            const chunkZ = currentChunkZ + j;
            const key = getChunkKey(chunkX, chunkZ);
            chunksToKeep.add(key);

            if (!activeChunks.has(key)) {
                // console.log(`Requesting load for chunk: ${chunkX}, ${chunkZ}`);
                // Add a placeholder to prevent re-requesting before promise resolves
                activeChunks.set(key, { status: 'loading' });
                
                // generateTerrainChunk is now async
                loadPromises.push(
                    generateTerrainChunk(chunkX, chunkZ, scene, world, terrainMaterial)
                        .then(newChunk => {
                            if (activeChunks.get(key)?.status === 'loading') { // Check if still relevant
                                activeChunks.set(key, newChunk);
                                // console.log(`Successfully loaded chunk: ${key}`);
                            } else {
                                // Chunk was marked for unloading before it finished loading
                                // Clean up the newly loaded but now unwanted chunk
                                scene.remove(newChunk.mesh);
                                if (newChunk.mesh.geometry) newChunk.mesh.geometry.dispose();
                                if (newChunk.mesh.material) cleanMaterial(newChunk.mesh.material);
                                world.removeBody(newChunk.body);
                                if (newChunk.populatedObjects) {
                                    newChunk.populatedObjects.forEach(obj => {
                                        scene.remove(obj);
                                        obj.traverse(child => {
                                            if (child.isMesh) {
                                                if (child.geometry) child.geometry.dispose();
                                                if (child.material) {
                                                    if (Array.isArray(child.material)) {
                                                        child.material.forEach(cleanMaterial);
                                                    } else {
                                                        cleanMaterial(child.material);
                                                    }
                                                }
                                            }
                                        });
                                    });
                                }
                                console.log(`Discarded late-loaded chunk: ${key}`);
                            }
                        })
                        .catch(error => {
                            console.error(`Error generating chunk ${chunkX},${chunkZ}:`, error);
                            if (activeChunks.get(key)?.status === 'loading') {
                                activeChunks.delete(key); // Remove placeholder on error
                            }
                        })
                );
            }
        }
    }

    await Promise.all(loadPromises); // Wait for all loading operations to complete

    // Unload chunks out of render distance
    activeChunks.forEach((chunkData, key) => {
        if (!chunksToKeep.has(key) && chunkData.status !== 'loading') { // Don't unload if it's still loading
            // console.log(`Unloading chunk: ${key}`);
            if (chunkData.mesh) {
                scene.remove(chunkData.mesh);
                if (chunkData.mesh.geometry) chunkData.mesh.geometry.dispose();
                if (chunkData.mesh.material) cleanMaterial(chunkData.mesh.material); // Use cleanMaterial
            }
            if (chunkData.body) {
                world.removeBody(chunkData.body);
            }

            // Clean up populated objects
            if (chunkData.populatedObjects) {
                // console.log(`Cleaning ${chunkData.populatedObjects.length} populated objects for chunk ${key}`);
                chunkData.populatedObjects.forEach(obj => {
                    scene.remove(obj); // obj is the root of the FBX model
                    obj.traverse(child => {
                        if (child.isMesh) {
                            if (child.geometry) child.geometry.dispose();
                            if (child.material) {
                                // Material can be an array
                                if (Array.isArray(child.material)) {
                                    child.material.forEach(cleanMaterial);
                                } else {
                                    cleanMaterial(child.material);
                                }
                            }
                        }
                    });
                });
            }
            activeChunks.delete(key);
        }
    });
    if (light.shadow) light.shadow.camera.updateProjectionMatrix();
}

// --- Airplane and ControlHandler Initialization ---
let airplane;
let controlHandler;

try {
    airplane = createAirplane(scene, world); // CRITICAL: Ensure createAirplane is robust
} catch (error) {
    console.error("Error during createAirplane():", error);
}

if (airplane) {
    console.log("Airplane object created:", airplane);
    // Ensure physicsBody exists before trying to use it
    if (airplane.physicsBody) {
        console.log("Airplane physicsBody exists.");
        airplane.physicsBody.material = airplaneMaterial;
        // Set initial position for the airplane
        airplane.physicsBody.position.set(0, CHUNK_SIZE * 0.5, 0); // Start higher to avoid immediate ground collision
        airplane.physicsBody.wakeUp(); // Ensure physics body is active

        // Sync visual model to physics model initially
        airplane.position.copy(airplane.physicsBody.position);
        airplane.quaternion.copy(airplane.physicsBody.quaternion);
    } else {
        console.error("Airplane created, but airplane.physicsBody is missing!");
        // Fallback for visual positioning if no physics body
        airplane.position.set(0, CHUNK_SIZE * 0.5, 0);
    }

    airplane.traverse(node => {
        if (node.isMesh) {
            node.castShadow = true;
            node.receiveShadow = true;
        }
    });

    try {
        controlHandler = new ControlHandler(airplane); // CRITICAL: Ensure ControlHandler is robust
    } catch (error) {
        console.error("Error during new ControlHandler():", error);
    }

    // Initial chunk load, only if airplane and its physics are ready
    if (airplane.physicsBody) {
        console.log("Attempting initial chunk load...");
        updateTerrainChunks(); // Load chunks around the airplane's starting position
    } else {
        console.warn("Skipping initial chunk load because airplane.physicsBody is missing.");
        // Fallback camera if no physics body for initial chunk centering
        camera.position.set(0, 50, 100);
        controls.target.set(0,0,0);
    }

} else {
    console.error("Airplane object was NOT created. Cannot proceed with airplane-dependent setup.");
    // Fallback camera if airplane creation failed entirely
    camera.position.set(0, 50, 100); // Basic camera setup
    controls.target.set(0,0,0);
    controls.update();
}
// --- End Airplane and ControlHandler Initialization ---


const cameraOffset = new THREE.Vector3(0, 10, -30);
const lookAtOffset = new THREE.Vector3(0, 5, 0);

let useFollowCamera = true;
window.addEventListener('keydown', (e) => {
    if (e.key === 'c') {
        useFollowCamera = !useFollowCamera;
        controls.enabled = !useFollowCamera;
        if (!useFollowCamera && airplane) {
            controls.target.copy(airplane.position);
        }
    }
});

if (airplane && airplane.physicsBody) {
    console.log("Attempting initial chunk load...");
    updateTerrainChunks().catch(error => console.error("Error during initial chunk load:", error));
}

function animate() {
    requestAnimationFrame(animate);
    const deltaTime = clock.getDelta();
    const fixedTimeStep = 1 / 60;

    // Update controls only if controlHandler was successfully initialized
    if (controlHandler) {
        try {
            controlHandler.update(deltaTime);
        } catch (error) {
            console.error("Error in controlHandler.update():", error);
            // Optionally disable controlHandler here to prevent further errors
            // controlHandler = null;
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

        updateTerrainChunks().catch(error => console.error("Error during chunk update in animate:", error)); // Fire and forget promise

        light.position.set(
            airplane.position.x + CHUNK_SIZE * 0.5,
            airplane.position.y + CHUNK_SIZE, // Keep light above
            airplane.position.z + CHUNK_SIZE * 0.5
        );
        light.target = airplane; // Make the light point towards the airplane
    }


    if (useFollowCamera && airplane) {
        const targetPosition = airplane.position.clone();
        const offset = cameraOffset.clone().applyQuaternion(airplane.quaternion);
        const desiredCameraPosition = targetPosition.clone().add(offset);

        const cameraLerpFactor = 0.07;
        camera.position.lerp(desiredCameraPosition, cameraLerpFactor);

        const lookAtPosition = targetPosition.clone().add(lookAtOffset.clone().applyQuaternion(airplane.quaternion));
        camera.lookAt(lookAtPosition);
    } else {
        controls.update(); // orbit controls
    }

    try {
        renderer.render(scene, camera);
    } catch (error) {
        console.error("Error during renderer.render():", error);
        // Consider stopping the animation loop if rendering fails catastrophically
        // cancelAnimationFrame(animate);
    }
}

// Start animation only if basic setup seems okay
// For instance, ensure renderer and camera are valid
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