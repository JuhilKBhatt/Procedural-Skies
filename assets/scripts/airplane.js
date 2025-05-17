import * as THREE from 'three';
import { loadFBXModel } from './LoadFBXModel.js';

export function createAirplane(scene) {
    const modelPath = 'assets/models/plane/Airplane.fbx';

    loadFBXModel(modelPath, new THREE.Vector3(0, 20, 0), scene, 0.005);
}