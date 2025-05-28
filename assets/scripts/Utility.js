// assets/scripts/Utility.js
import * as THREE from 'three';
// cleanMaterial is already here and uses THREE

/**
 * Generates a unique string key for a chunk based on its grid coordinates.
 * @param {number} chunkX - The X coordinate of the chunk in the grid.
 * @param {number} chunkZ - The Z coordinate of the chunk in the grid.
 * @returns {string} A string key representing the chunk's coordinates.
 */
export function getChunkKey(chunkX, chunkZ) {
    return `${chunkX},${chunkZ}`;
}

/**
 * Disposes of a Three.js material and its associated textures.
 * @param {THREE.Material | THREE.Material[]} material - The material or array of materials to dispose of.
 */
export function cleanMaterial(material) {
    if (!material) return;

    if (Array.isArray(material)) {
        material.forEach(mat => cleanSingleMaterial(mat));
    } else {
        cleanSingleMaterial(material);
    }
}

function cleanSingleMaterial(mat) {
    if (!mat) return;
    mat.dispose();

    // Dispose textures
    for (const key of Object.keys(mat)) {
        const value = mat[key];
        if (value && typeof value === 'object' && value.isTexture) {
            value.dispose();
        }
    }
}

/**
 * Updates terrain chunks based on player position.
 * Manages loading and unloading of chunks.
 * @param {object} params - Parameters for updating terrain chunks.
 * @param {THREE.Object3D} params.airplane - The airplane object, must have a physicsBody with position.
 * @param {Map} params.activeChunks - Map of currently active/loading chunks.
 * @param {number} params.currentLastPlayerChunkX - The last recorded player chunk X.
 * @param {number} params.currentLastPlayerChunkZ - The last recorded player chunk Z.
 * @param {THREE.Scene} params.scene - The Three.js scene.
 * @param {CANNON.World} params.world - The Cannon.js world.
 * @param {CANNON.Material} params.terrainMaterial - The Cannon.js material for terrain.
 * @param {THREE.DirectionalLight} params.light - The main directional light for shadow updates.
 * @param {number} params.CHUNK_SIZE - The size of each chunk.
 * @param {number} params.VIEW_DISTANCE_CHUNKS - The view distance in chunks.
 * @param {function} params.generateTerrainChunk - Function to generate a new terrain chunk.
 * @param {object} params.worldGenSettings - Settings for terrain generation (e.g., height, noise).
 * @param {object} params.worldPopSettings - Settings for world population (e.g., object density).
 * @returns {Promise<{lastPlayerChunkX: number, lastPlayerChunkZ: number}>} Resolves with the updated player chunk coordinates.
 */
export async function updateTerrainChunks({
    airplane,
    activeChunks,
    currentLastPlayerChunkX,
    currentLastPlayerChunkZ,
    scene,
    world,
    terrainMaterial,
    light,
    CHUNK_SIZE,
    VIEW_DISTANCE_CHUNKS,
    generateTerrainChunk,
    worldGenSettings,  // <-- Added
    worldPopSettings   // <-- Added
}) {
    if (!airplane || !airplane.physicsBody || !airplane.physicsBody.position) {
        console.warn("Airplane or its physics body/position is not available for chunk update.");
        return { lastPlayerChunkX: currentLastPlayerChunkX, lastPlayerChunkZ: currentLastPlayerChunkZ };
    }
     if (!worldGenSettings || !worldPopSettings) {
        console.error("worldGenSettings or worldPopSettings are missing in updateTerrainChunks call!");
        // Potentially use defaults or skip update if critical settings are missing
        return { lastPlayerChunkX: currentLastPlayerChunkX, lastPlayerChunkZ: currentLastPlayerChunkZ };
    }


    const playerX = airplane.physicsBody.position.x;
    const playerZ = airplane.physicsBody.position.z;

    const currentChunkX = Math.floor(playerX / CHUNK_SIZE);
    const currentChunkZ = Math.floor(playerZ / CHUNK_SIZE);

    if (currentChunkX === currentLastPlayerChunkX && currentChunkZ === currentLastPlayerChunkZ && activeChunks.size > 0) {
        return { lastPlayerChunkX: currentLastPlayerChunkX, lastPlayerChunkZ: currentLastPlayerChunkZ };
    }

    let newLastPlayerChunkX = currentChunkX;
    let newLastPlayerChunkZ = currentChunkZ;

    const chunksToKeep = new Set();
    const loadPromises = [];

    for (let i = -VIEW_DISTANCE_CHUNKS; i <= VIEW_DISTANCE_CHUNKS; i++) {
        for (let j = -VIEW_DISTANCE_CHUNKS; j <= VIEW_DISTANCE_CHUNKS; j++) {
            const chunkX = currentChunkX + i;
            const chunkZ = currentChunkZ + j;
            const key = getChunkKey(chunkX, chunkZ);
            chunksToKeep.add(key);

            if (!activeChunks.has(key)) {
                activeChunks.set(key, { status: 'loading' }); // Mark as loading
                loadPromises.push(
                    generateTerrainChunk(
                        chunkX,
                        chunkZ,
                        scene,
                        world,
                        terrainMaterial,
                        worldGenSettings, // Pass settings
                        worldPopSettings  // Pass settings
                    )
                        .then(newChunk => {
                            // Check if the chunk is still supposed to be loading/active
                            const currentStatus = activeChunks.get(key);
                            if (currentStatus && currentStatus.status === 'loading') {
                                activeChunks.set(key, newChunk);
                            } else {
                                // Chunk was removed or load was cancelled before completing
                                console.log(`Discarding late-loaded or cancelled chunk: ${key}`);
                                scene.remove(newChunk.mesh);
                                if (newChunk.mesh.geometry) newChunk.mesh.geometry.dispose();
                                if (newChunk.mesh.material) cleanMaterial(newChunk.mesh.material);
                                if (newChunk.body) world.removeBody(newChunk.body); // Ensure body is removed
                                if (newChunk.populatedObjects) {
                                    newChunk.populatedObjects.forEach(obj => {
                                        scene.remove(obj);
                                        obj.traverse(child => {
                                            if (child.isMesh) {
                                                if (child.geometry) child.geometry.dispose();
                                                if (child.material) cleanMaterial(child.material);
                                            }
                                        });
                                    });
                                }
                            }
                        })
                        .catch(error => {
                            console.error(`Error generating chunk ${key}:`, error);
                            if (activeChunks.get(key)?.status === 'loading') { // Check status before deleting
                                activeChunks.delete(key);
                            }
                        })
                );
            }
        }
    }

    // Wait for all new chunk generation promises to resolve or reject
    try {
        await Promise.all(loadPromises);
    } catch (error) {
        // This catch block might be redundant if individual promises handle their errors,
        // but it's good for a top-level catch for Promise.all itself.
        console.error("Error during batch chunk loading:", error);
    }


    // Unload chunks that are no longer in view
    activeChunks.forEach((chunkData, key) => {
        if (!chunksToKeep.has(key)) {
            // Only remove if it's fully loaded (not in 'loading' state)
            // Or if it has actual mesh/body data (indicating it was at least partially processed)
            if (chunkData.status !== 'loading' || chunkData.mesh) {
                if (chunkData.mesh) {
                    scene.remove(chunkData.mesh);
                    if (chunkData.mesh.geometry) chunkData.mesh.geometry.dispose();
                    if (chunkData.mesh.material) cleanMaterial(chunkData.mesh.material);
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
                                if (child.material) cleanMaterial(child.material);
                            }
                        });
                    });
                }
                activeChunks.delete(key);
                // console.log(`Unloaded chunk: ${key}`);
            }
        }
    });

    if (light && light.shadow) {
        light.shadow.camera.updateProjectionMatrix();
    }

    return { lastPlayerChunkX: newLastPlayerChunkX, lastPlayerChunkZ: newLastPlayerChunkZ };
}