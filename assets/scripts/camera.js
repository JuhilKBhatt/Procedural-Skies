// assets/scripts/camera.js
import * as THREE from 'three';
import { OrbitControls } from 'https://unpkg.com/three@0.152.0/examples/jsm/controls/OrbitControls.js';

const DEFAULT_CAMERA_FOV = 75;
const DEFAULT_CAMERA_NEAR = 0.1;

export class CameraHandler {
    constructor(rendererDomElement, config = {}) {
        this.rendererDomElement = rendererDomElement;
        this.config = {
            fov: config.fov || DEFAULT_CAMERA_FOV,
            aspect: config.aspect || window.innerWidth / window.innerHeight,
            near: config.near || DEFAULT_CAMERA_NEAR,
            far: config.far || 10000,
            cameraOffset: config.cameraOffset || new THREE.Vector3(0, 10, -30),
            lookAtOffset: config.lookAtOffset || new THREE.Vector3(0, 5, 0),
            initialChunkSize: config.initialChunkSize || 1000
        };

        this.camera = new THREE.PerspectiveCamera(
            this.config.fov,
            this.config.aspect,
            this.config.near,
            this.config.far
        );

        this.controls = new OrbitControls(this.camera, this.rendererDomElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.screenSpacePanning = false;
        this.controls.minDistance = 10;
        this.controls.maxDistance = 1000; // Initial maxDistance

        this.targetObject = null;
        this.useFollowCamera = true;
        this.controls.enabled = !this.useFollowCamera; // Orbit controls disabled when follow cam is active

        this.cameraLerpFactor = 0.07; // Factor for positional and rotational smoothing

        // Helper objects for quaternion slerp to avoid re-creation per frame
        this._tempMatrix = new THREE.Matrix4();
        this._targetQuaternion = new THREE.Quaternion();


        this.initEventListeners();

        // Set initial far plane based on CHUNK_SIZE if provided
        if (config.initialChunkSize) {
            this.setFarPlane(config.initialChunkSize * 20);
            this.controls.maxDistance = config.initialChunkSize * 10; // Adjust orbit control max distance
        }
    }

    initEventListeners() {
        window.addEventListener('keydown', (e) => this.onKeyDown(e));
    }

    onKeyDown(event) {
        if (event.key === 'c' || event.key === 'C') {
            this.toggleCameraMode();
        }
    }

    setTarget(target) {
        this.targetObject = target;
        if (!this.useFollowCamera && this.targetObject && this.targetObject.position) {
            this.controls.target.copy(this.targetObject.position);
        }
        if (this.useFollowCamera && this.targetObject) {
            this.updateFollowCameraLogic(1.0);
        }
    }

    setFarPlane(farValue) {
        this.camera.far = farValue;
        this.camera.updateProjectionMatrix();
    }

    setFallbackMode(position = new THREE.Vector3(0, 50, 100), lookAt = new THREE.Vector3(0, 0, 0)) {
        this.useFollowCamera = false;
        this.controls.enabled = true;
        this.camera.position.copy(position);
        this.controls.target.copy(lookAt);
        this.controls.update();
        console.log("Camera set to fallback mode.");
    }

    toggleCameraMode() {
        this.useFollowCamera = !this.useFollowCamera;
        this.controls.enabled = !this.useFollowCamera;

        if (!this.useFollowCamera && this.targetObject && this.targetObject.position) {
            this.controls.target.copy(this.targetObject.position);
            const currentOffset = this.camera.position.clone().sub(this.targetObject.position);
            this.camera.position.copy(this.targetObject.position.clone().add(currentOffset));
            this.controls.update();
        } else if (this.useFollowCamera && this.targetObject) {
             this.updateFollowCameraLogic(1.0);
        }
        console.log(`Camera mode toggled. Follow Camera: ${this.useFollowCamera}`);
    }

    updateFollowCameraLogic(lerpFactor) {
        if (!this.targetObject || !this.targetObject.position || !this.targetObject.quaternion) return;
        const targetBodyPosition = this.targetObject.position.clone();
        const offset = this.config.cameraOffset.clone().applyQuaternion(this.targetObject.quaternion);
        const desiredCameraPosition = targetBodyPosition.clone().add(offset);

        this.camera.position.lerp(desiredCameraPosition, lerpFactor);

        const lookAtPosition = targetBodyPosition.clone().add(this.config.lookAtOffset.clone().applyQuaternion(this.targetObject.quaternion));
        

        this._tempMatrix.lookAt(this.camera.position, lookAtPosition, this.camera.up);
        this._targetQuaternion.setFromRotationMatrix(this._tempMatrix);
        this.camera.quaternion.slerp(this._targetQuaternion, lerpFactor);
    }

    update(_deltaTime) {
        if (this.useFollowCamera && this.targetObject) {
            this.updateFollowCameraLogic(this.cameraLerpFactor);
        } else {
            this.controls.update();
        }
    }

    handleResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
    }

    getCamera() {
        return this.camera;
    }

    getControls() {
        return this.controls;
    }
}