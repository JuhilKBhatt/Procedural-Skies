import * as THREE from 'three';
import { loadFBXModel } from './LoadFBXModel.js';

/**
 * Populates the scene with trees, rocks, seaweed, and clouds asynchronously.
 * @param {THREE.Scene} scene - The Three.js scene object.
 * @param {THREE.Mesh} terrain - The generated terrain mesh.
 */
export function populateWorld(scene, terrain) {
    const treeModels = [
        'assets/models/tree/TreePine.fbx',
        'assets/models/tree/TreeRound.fbx'
    ];

    const rockModels = [
        'assets/models/rock/Rock1.fbx', 'assets/models/rock/Rock2.fbx', 'assets/models/rock/Rock3.fbx',
        'assets/models/rock/Rock4.fbx', 'assets/models/rock/Rock5.fbx', 'assets/models/rock/Rock6.fbx'
    ];

    const seaWeedModels = [
        'assets/models/river/SeaWeed1.fbx', 'assets/models/river/SeaWeed2.fbx'
    ];

    const cloudModels = [
        'assets/models/cloud/Cloud_1.fbx', 'assets/models/cloud/Cloud_2.fbx', 'assets/models/cloud/Cloud_3.fbx',
        'assets/models/cloud/Cloud_4.fbx'
    ];

    const allModels = [...treeModels, ...rockModels, ...seaWeedModels];

    // Calculate terrain size
    const boundingBox = new THREE.Box3().setFromObject(terrain);
    const terrainWidth = boundingBox.max.x - boundingBox.min.x;
    const terrainDepth = boundingBox.max.z - boundingBox.min.z;

    const batchSize = 20;
    let currentCluster = 0;
    const totalClusters = 100;

    function loadNextBatch() {
        if (currentCluster >= totalClusters) return;

        // Load a batch of models
        for (let b = 0; b < batchSize; b++) {
            // Randomly select a model from the combined list
            if (currentCluster >= totalClusters) break;

            const centerX = (Math.random() - 0.5) * terrainWidth;
            const centerZ = (Math.random() - 0.5) * terrainDepth;

            const raycaster = new THREE.Raycaster(
                new THREE.Vector3(centerX, 100, centerZ),
                new THREE.Vector3(0, -1, 0)
            );
            const intersects = raycaster.intersectObject(terrain);

            if (intersects.length === 0) continue;
            const intersection = intersects[0];
            const y = intersection.point.y + 0.1;

            const density = Math.floor(Math.random() * 15) + 5;
            const clusterRadius = Math.random() * 15 + 10;

            for (let t = 0; t < density; t++) {
                const angle = Math.random() * 2 * Math.PI;
                const radius = Math.random() * clusterRadius;
                const x = centerX + Math.cos(angle) * radius;
                const z = centerZ + Math.sin(angle) * radius;

                const ray = new THREE.Raycaster(
                    new THREE.Vector3(x, 100, z),
                    new THREE.Vector3(0, -1, 0)
                );
                const hit = ray.intersectObject(terrain);

                if (hit.length > 0) {
                    const finalY = hit[0].point.y + 0.1;
                    const modelPath = allModels[Math.floor(Math.random() * allModels.length)];
                    const randomScale = Math.random() * 0.005 + 0.008;
                    loadFBXModel(modelPath, new THREE.Vector3(x, finalY, z), scene, randomScale);
                }
            }

            // Cloud generation
            const numClouds = Math.floor(Math.random() * 0) + 1;
            for (let c = 0; c < numClouds; c++) {
                const cloudX = (Math.random() - 0.5) * terrainWidth;
                const cloudZ = (Math.random() - 0.5) * terrainDepth;
                const cloudY = Math.random() * 100 + 150; // Height

                const cloudModelPath = cloudModels[Math.floor(Math.random() * cloudModels.length)];
                const cloudScale = Math.random() * 0.02 + 0.05;
                loadFBXModel(cloudModelPath, new THREE.Vector3(cloudX, cloudY, cloudZ), scene, cloudScale);
            }

            currentCluster++;
        }

        requestAnimationFrame(loadNextBatch);
    }

    loadNextBatch();
}