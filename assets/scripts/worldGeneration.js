// assets/scripts/worldGeneration.js
import * as THREE from 'three';
import { generateCombinedTerrain } from './perlinNoise.js';
import { calculateVertexColor } from './worldColour.js';
import * as CANNON from 'cannon-es';

export function generateTerrainChunk(scene, world, terrainMaterial, chunkX, chunkZ, chunkSize, chunkSegments, terrainMaxHeight, terrainMinHeight, noiseInputScale) {
    const geometry = new THREE.PlaneGeometry(chunkSize, chunkSize, chunkSegments, chunkSegments);
    const vertices = geometry.attributes.position.array;
    // Ensure colors array is the correct size: (segments+1) * (segments+1) vertices * 3 components (rgb)
    const colors = new Float32Array((chunkSegments + 1) * (chunkSegments + 1) * 3);

    const cannonRows = chunkSegments + 1; // Number of vertices along one edge for Cannon
    const cannonCols = chunkSegments + 1;
    const cannonHeightfieldData = []; // Stores height data for Cannon.js: array of arrays

    for (let i = 0; i < cannonRows; i++) { // Corresponds to Z-axis segments in the local grid of the plane
        const rowHeights = [];
        for (let j = 0; j < cannonCols; j++) { // Corresponds to X-axis segments
            // Local coordinates on the unrotated THREE.PlaneGeometry (which is in XY plane)
            const localXPlane = (j / chunkSegments - 0.5) * chunkSize;
            const localYPlane = (i / chunkSegments - 0.5) * chunkSize; // This becomes world Z after rotation

            // Calculate world coordinates for Perlin noise sampling
            const worldX = chunkX * chunkSize + localXPlane;
            const worldZ = chunkZ * chunkSize + localYPlane;

            const normalizedHeight = generateCombinedTerrain(worldX * noiseInputScale, worldZ * noiseInputScale, 0);
            const actualHeight = terrainMinHeight + normalizedHeight * (terrainMaxHeight - terrainMinHeight);

            // In PlaneGeometry, vertices are (x, y, z). We modify z, which becomes the height.
            const vertexArrayIndex = (i * cannonCols + j) * 3;
            vertices[vertexArrayIndex + 0] = localXPlane;
            vertices[vertexArrayIndex + 1] = localYPlane;
            vertices[vertexArrayIndex + 2] = actualHeight; // This is the height value

            rowHeights.push(actualHeight);

            // Vertex color
            const color = calculateVertexColor(normalizedHeight);
            colors[vertexArrayIndex + 0] = color.r;
            colors[vertexArrayIndex + 1] = color.g;
            colors[vertexArrayIndex + 2] = color.b;
        }
        cannonHeightfieldData.push(rowHeights);
    }

    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals(); // Recalculate normals after modifying vertices

    const material = new THREE.MeshPhongMaterial({
        vertexColors: true,
        shininess: 5,
        // wireframe: true, // Uncomment for debugging chunk boundaries
    });

    const terrainMesh = new THREE.Mesh(geometry, material);
    // Rotate the plane to be horizontal (XZ plane, Y-up)
    terrainMesh.rotation.x = -Math.PI / 2;
    // Position the center of the chunk mesh
    terrainMesh.position.set(chunkX * chunkSize, 0, chunkZ * chunkSize);

    terrainMesh.castShadow = true;
    terrainMesh.receiveShadow = true;
    scene.add(terrainMesh);

    // --- Cannon.js Heightfield ---
    // CANNON.Heightfield takes data[i][j] where i is along its local X, j along its local Y.
    // Heights are along its local Z.
    // To align with our Three.js mesh (XZ plane, Y up for height):
    // We need to provide data where outer array iterates along world X, inner along world Z.
    // Or, provide data as [z][x] and then rotate the body appropriately.
    // Let's structure cannonHeightfieldData as [x_values][z_values] = y_height for consistency.
    // The loop above generates cannonHeightfieldData[z_idx][x_idx]. We might need to transpose it
    // or ensure Cannon.js Heightfield interprets it as we intend.

    // Cannon.js Heightfield constructor expects `matrix[rows][columns]` where `elementSize` applies.
    // The heights are then applied along the Heightfield's local Z-axis.
    // Our `cannonHeightfieldData` is `data[z_segments][x_segments]`.
    const hfShape = new CANNON.Heightfield(cannonHeightfieldData, {
        elementSize: chunkSize / chunkSegments // Distance between data points in the grid
    });

    const groundBody = new CANNON.Body({ mass: 0, material: terrainMaterial });
    groundBody.addShape(hfShape);

    // Position and orient the Cannon.js Heightfield body:
    // The Heightfield shape is created in its local XY plane with heights along its local Z.
    // We need to rotate the *body* so that its local XY plane becomes the world XZ plane,
    // and its local Z (height direction) becomes the world Y.
    groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);

    // The position of the body should be the world coordinate of the Heightfield's origin
    // (the corner corresponding to the first data point matrix[0][0]).
    // After rotation, this origin needs to align with the start of our chunk.
    groundBody.position.set(
        chunkX * chunkSize - chunkSize / 2, // World X of the first data point
        0,                                  // Base Y (heights in data are absolute)
        chunkZ * chunkSize + chunkSize / 2  // World Z of the first data point (Cannon's Y becomes world Z, positive Y points to negative world Z with this rotation)
    );
    // Correction for Z position with the -PI/2 Euler rotation on X for the body:
    // Cannon local X -> World X
    // Cannon local Y -> World Z
    // Cannon local Z (height values from data) -> World Y
    // So, the groundBody.position should be the world coordinates of the corner:
    // (chunk_min_x, 0, chunk_min_z)
    groundBody.position.set(
        (chunkX * chunkSize) - (chunkSize / 2),
        0, // Heights are in the data, so base level is 0.
        (chunkZ * chunkSize) - (chunkSize / 2)
    );


    world.addBody(groundBody);

    return {
        mesh: terrainMesh,
        body: groundBody,
        chunkX: chunkX,
        chunkZ: chunkZ,
        dispose: function() {
            scene.remove(this.mesh);
            if (this.mesh.geometry) this.mesh.geometry.dispose();
            // Material might be shared, but for simplicity, dispose if not using a shared instance.
            if (this.mesh.material) this.mesh.material.dispose();
            world.removeBody(this.body);
            // Cannon.js shapes usually don't need explicit disposal beyond removing the body
            // as they are part of the body.
        }
    };
}