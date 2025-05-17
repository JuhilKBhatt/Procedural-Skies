// airplane.js
import * as THREE from 'three';
import { loadFBXModel } from './LoadFBXModel.js';

export function createAirplane(scene) {
    const modelPath = 'assets/models/plane/Airplane.fbx';
    const airplane = new THREE.Group();
    loadFBXModel(modelPath, new THREE.Vector3(0, 20, 0), airplane, 0.005);
    airplane.rotateY(Math.PI);
    scene.add(airplane);
    return airplane;
}