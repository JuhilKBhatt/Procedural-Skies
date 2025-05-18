// worldPopulate.js
import * as THREE from 'three';
import { loadFBXModel } from './LoadFBXModel.js';

/**
 * Populates the scene with trees, rocks, and seaweed asynchronously based on terrain color.
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

    // Terrain color categories (using the same values as in worldColour.js for consistency)
    const waterDeepColor = new THREE.Color(0x003366);
    const waterShallowColor = new THREE.Color(0x007bff);
    const sandColor = new THREE.Color(0xf4a460);
    const grassColor = new THREE.Color(0x228b22);
    const dirtColor = new THREE.Color(0x8b4513);
    const rockColor = new THREE.Color(0x808080);
    const snowColor = new THREE.Color(0xfffafa);

    // Calculate terrain size
    const boundingBox = new THREE.Box3().setFromObject(terrain);
    const terrainWidth = boundingBox.max.x - boundingBox.min.x;
    const terrainDepth = boundingBox.max.z - boundingBox.min.z;

    const batchSize = 20;  // Number of object clusters loaded per batch
    let currentCluster = 0;
    const totalClusters = 100; // Limit total clusters to avoid overload

    function loadNextBatch() {
        if (currentCluster >= totalClusters) return;

        for (let b = 0; b < batchSize; b++) {
            if (currentCluster >= totalClusters) break;

            // Random center for each cluster within terrain bounds
            const centerX = (Math.random() - 0.5) * terrainWidth;
            const centerZ = (Math.random() - 0.5) * terrainDepth;

            // Raycasting to find the height and color at the center
            const raycaster = new THREE.Raycaster(
                new THREE.Vector3(centerX, 100, centerZ),
                new THREE.Vector3(0, -1, 0)
            );
            const intersects = raycaster.intersectObject(terrain);

            if (intersects.length === 0) continue;
            const intersection = intersects[0];
            const y = intersection.point.y;

            // Get the vertex color at the intersection point
            const color = new THREE.Color();
            const colorAttribute = terrain.geometry.attributes.color;
            const positionAttribute = terrain.geometry.attributes.position;
            const indices = terrain.geometry.index;

            if (colorAttribute && positionAttribute && indices) {
                const face = intersection.face;
                let vA, vB, vC;

                if (indices) {
                    vA = indices.getX(face.a);
                    vB = indices.getX(face.b);
                    vC = indices.getX(face.c);
                } else {
                    vA = face.a;
                    vB = face.b;
                    vC = face.c;
                }

                const colorA = new THREE.Color().fromBufferAttribute(colorAttribute, vA);
                const colorB = new THREE.Color().fromBufferAttribute(colorAttribute, vB);
                const colorC = new THREE.Color().fromBufferAttribute(colorAttribute, vC);

                // Interpolate colors based on barycentric coordinates (intersection.uv)
                const uv = intersection.uv;
                color.lerpColors(colorA, colorB, uv.x).lerp(colorC, 1 - uv.x - uv.y);
            } else {
                console.warn("Terrain geometry doesn't have color or position attributes, or index buffer.");
                continue;
            }

            let models = [];
            let density = 0;
            const maxObjectsPerCluster = 50; // Limit objects per cluster

            // Model selection based on color
            if (color.equals(waterDeepColor) || color.equals(waterShallowColor)) {
                models = seaWeedModels;
                density = Math.floor(Math.random() * 10) + 5; // Fewer seaweed
            } else if (color.equals(sandColor)) {
                continue; // No objects on the beach for now
            } else if (color.equals(grassColor)) {
                models = Math.random() < 0.6 ? treeModels : rockModels;
                density = Math.floor(Math.random() * 15) + 10;
            } else if (color.equals(dirtColor)) {
                models = Math.random() < 0.3 ? treeModels : rockModels; // Fewer trees on dirt
                density = Math.floor(Math.random() * 10) + 5;
            } else if (color.equals(rockColor)) {
                models = rockModels;
                density = Math.floor(Math.random() * 10) + 5;
            } else if (color.equals(snowColor)) {
                continue; // No objects on snow for now
            }

            density = Math.min(density, maxObjectsPerCluster);
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
                    const finalY = hit[0].point.y + 0.1; // Add a small offset to prevent z-fighting
                    const modelPath = models[Math.floor(Math.random() * models.length)];
                    const randomScale = Math.random() * 0.0003 + 0.0003; // Vary scale slightly

                    loadFBXModel(modelPath, new THREE.Vector3(x, finalY, z), scene, randomScale);
                }
            }

            currentCluster++;
        }

        requestAnimationFrame(loadNextBatch);
    }

    loadNextBatch();
}