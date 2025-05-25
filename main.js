// main.js
import * as THREE from 'three';
import { OrbitControls } from 'https://unpkg.com/three@0.152.0/examples/jsm/controls/OrbitControls.js';
import { generateTerrainChunk, CHUNK_SIZE, CHUNK_SEGMENTS } from './assets/scripts/worldGeneration.js';
import { createAirplane } from './assets/scripts/airplane.js';
import { ControlHandler } from './assets/scripts/controlHandler.js';
import * as CANNON from 'cannon-es';
import { getChunkKey, cleanMaterial } from './assets/scripts/Utility.js';

const clock = new THREE.Clock();
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, CHUNK_SIZE * 2, CHUNK_SIZE * 8);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, CHUNK_SIZE * 20);
const renderer = new THREE.WebGLRenderer({ antialias: true });

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

async function updateTerrainChunks() {
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
    const loadPromises = [];

    for (let i = -VIEW_DISTANCE_CHUNKS; i <= VIEW_DISTANCE_CHUNKS; i++) {
        for (let j = -VIEW_DISTANCE_CHUNKS; j <= VIEW_DISTANCE_CHUNKS; j++) {
            const chunkX = currentChunkX + i;
            const chunkZ = currentChunkZ + j;
            const key = getChunkKey(chunkX, chunkZ); // Uses imported function
            chunksToKeep.add(key);

            if (!activeChunks.has(key)) {
                activeChunks.set(key, { status: 'loading' });
                loadPromises.push(
                    generateTerrainChunk(chunkX, chunkZ, scene, world, terrainMaterial)
                        .then(newChunk => {
                            if (activeChunks.get(key)?.status === 'loading') {
                                activeChunks.set(key, newChunk);
                            } else {
                                scene.remove(newChunk.mesh);
                                if (newChunk.mesh.geometry) newChunk.mesh.geometry.dispose();
                                if (newChunk.mesh.material) cleanMaterial(newChunk.mesh.material); // Uses imported function
                                world.removeBody(newChunk.body);
                                if (newChunk.populatedObjects) {
                                    newChunk.populatedObjects.forEach(obj => {
                                        scene.remove(obj);
                                        obj.traverse(child => {
                                            if (child.isMesh) {
                                                if (child.geometry) child.geometry.dispose();
                                                if (child.material) {
                                                    cleanMaterial(child.material); // Uses imported function
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
                                activeChunks.delete(key);
                            }
                        })
                );
            }
        }
    }

    await Promise.all(loadPromises);

    activeChunks.forEach((chunkData, key) => {
        if (!chunksToKeep.has(key) && chunkData.status !== 'loading') {
            if (chunkData.mesh) {
                scene.remove(chunkData.mesh);
                if (chunkData.mesh.geometry) chunkData.mesh.geometry.dispose();
                if (chunkData.mesh.material) cleanMaterial(chunkData.mesh.material); // Uses imported function
            }
            if (chunkData.body) {
                world.removeBody(chunkData.body);
            }
            if (chunkData.populatedObjects) {
                chunkData.populatedObjects.forEach(obj => {
                    scene.remove(obj);
                    obj.traverse(child => {
                        if (child.isMesh) {
                            if (child.geometry) child.geometry.dispose();
                            if (child.material) {
                                cleanMaterial(child.material); // Uses imported function
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

    if (airplane.physicsBody) { // This first call to updateTerrainChunks is fine.
        console.log("Attempting initial chunk load (inside airplane check)...");
        updateTerrainChunks().catch(error => console.error("Error during initial chunk load (inside airplane check):", error));
    } else {
        console.warn("Skipping initial chunk load because airplane.physicsBody is missing.");
        camera.position.set(0, 50, 100);
        controls.target.set(0,0,0);
    }

} else {
    console.error("Airplane object was NOT created. Cannot proceed with airplane-dependent setup.");
    camera.position.set(0, 50, 100);
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

function animate() {
    requestAnimationFrame(animate);
    const deltaTime = clock.getDelta();
    const fixedTimeStep = 1 / 60;

    if (controlHandler) {
        try {
            controlHandler.update(deltaTime);
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

        updateTerrainChunks().catch(error => console.error("Error during chunk update in animate:", error));

        light.position.set(
            airplane.position.x + CHUNK_SIZE * 0.5,
            airplane.position.y + CHUNK_SIZE,
            airplane.position.z + CHUNK_SIZE * 0.5
        );
        light.target = airplane;
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
        controls.update();
    }

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