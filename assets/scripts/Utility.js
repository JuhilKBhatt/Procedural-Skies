// Utility.js
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
    generateTerrainChunk
}) {
    if (!airplane || !airplane.physicsBody || !airplane.physicsBody.position) {
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
            const key = getChunkKey(chunkX, chunkZ); // Uses local getChunkKey
            chunksToKeep.add(key);

            if (!activeChunks.has(key)) {
                activeChunks.set(key, { status: 'loading' });
                loadPromises.push(
                    generateTerrainChunk(chunkX, chunkZ, scene, world, terrainMaterial)
                        .then(newChunk => {
                            if (activeChunks.get(key)?.status === 'loading') {
                                activeChunks.set(key, newChunk);
                            } else {
                                // Chunk was removed before loading completed, or marked for removal
                                scene.remove(newChunk.mesh);
                                if (newChunk.mesh.geometry) newChunk.mesh.geometry.dispose();
                                if (newChunk.mesh.material) cleanMaterial(newChunk.mesh.material); // Uses local cleanMaterial
                                world.removeBody(newChunk.body);
                                if (newChunk.populatedObjects) {
                                    newChunk.populatedObjects.forEach(obj => {
                                        scene.remove(obj);
                                        obj.traverse(child => {
                                            if (child.isMesh) {
                                                if (child.geometry) child.geometry.dispose();
                                                if (child.material) {
                                                    cleanMaterial(child.material); // Uses local cleanMaterial
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
                if (chunkData.mesh.material) cleanMaterial(chunkData.mesh.material); // Uses local cleanMaterial
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
                                cleanMaterial(child.material); // Uses local cleanMaterial
                            }
                        }
                    });
                });
            }
            activeChunks.delete(key);
        }
    });
    if (light && light.shadow) light.shadow.camera.updateProjectionMatrix();

    return { lastPlayerChunkX: newLastPlayerChunkX, lastPlayerChunkZ: newLastPlayerChunkZ };
}