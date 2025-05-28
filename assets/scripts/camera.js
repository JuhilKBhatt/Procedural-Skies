// camera.js
import * as THREE from 'three';
import { OrbitControls } from 'https://unpkg.com/three@0.152.0/examples/jsm/controls/OrbitControls.js';

const DEFAULT_CAMERA_FOV = 75;
const DEFAULT_CAMERA_NEAR = 0.1;
// CHUNK_SIZE will be passed in config for far plane and default positions

export class CameraHandler {
    constructor(rendererDomElement, config = {}) {
        this.rendererDomElement = rendererDomElement;
        this.config = {
            fov: config.fov || DEFAULT_CAMERA_FOV,
            aspect: config.aspect || window.innerWidth / window.innerHeight,
            near: config.near || DEFAULT_CAMERA_NEAR,
            far: config.far || 10000, // Default far, can be updated based on CHUNK_SIZE
            cameraOffset: config.cameraOffset || new THREE.Vector3(0, 10, -30),
            lookAtOffset: config.lookAtOffset || new THREE.Vector3(0, 5, 0),
            initialChunkSize: config.initialChunkSize || 100 // Default if not provided
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
        // Resize listener is separate to allow main.js to control renderer.setSize
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
        // If target is set, update follow camera immediately if active
        if (this.useFollowCamera && this.targetObject) {
            this.updateFollowCameraLogic(1.0); // Teleport camera to target instantly (100% lerp)
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
            // When switching to OrbitControls, set its target to the current airplane position
            this.controls.target.copy(this.targetObject.position);
            // Set camera to its current offset relative to the target for a smoother transition
            const currentOffset = this.camera.position.clone().sub(this.targetObject.position);
            this.camera.position.copy(this.targetObject.position.clone().add(currentOffset));
            this.controls.update();
        } else if (this.useFollowCamera && this.targetObject) {
            // When switching back to follow camera, instantly update to avoid lag
             this.updateFollowCameraLogic(1.0); // Teleport to target (100% lerp for position and rotation)
        }
        console.log(`Camera mode toggled. Follow Camera: ${this.useFollowCamera}`);
    }

    updateFollowCameraLogic(lerpFactor) {
        if (!this.targetObject || !this.targetObject.position || !this.targetObject.quaternion) return;

        const targetBodyPosition = this.targetObject.position.clone(); // Position of the airplane's physics body
        
        // 1. Calculate the desired camera position
        // The offset is rotated by the airplane's quaternion to follow its orientation
        const offset = this.config.cameraOffset.clone().applyQuaternion(this.targetObject.quaternion);
        const desiredCameraPosition = targetBodyPosition.clone().add(offset);

        // 2. Lerp the camera's actual position towards the desired position
        this.camera.position.lerp(desiredCameraPosition, lerpFactor);

        // 3. Calculate the desired look-at point
        // This point is also relative to the airplane and rotates with it
        const lookAtPosition = targetBodyPosition.clone().add(this.config.lookAtOffset.clone().applyQuaternion(this.targetObject.quaternion));
        
        // 4. Smoothly update camera orientation (rotation)
        // Instead of direct camera.lookAt(), we slerp the quaternion.

        // Set the temporary matrix to look from the camera's NEW (lerped) position towards the lookAtPosition.
        // The camera's 'up' vector (usually Y-axis) is used to orient this lookAt.
        this._tempMatrix.lookAt(this.camera.position, lookAtPosition, this.camera.up);
        
        // Extract the desired rotation as a quaternion from this matrix.
        this._targetQuaternion.setFromRotationMatrix(this._tempMatrix);

        // Spherically interpolate (slerp) the camera's current quaternion towards the target quaternion.
        // This creates a smooth rotational transition.
        this.camera.quaternion.slerp(this._targetQuaternion, lerpFactor);

        // The direct camera.lookAt(lookAtPosition) is no longer needed here.
    }

    update(_deltaTime) { // deltaTime can be used for more sophisticated lerping if needed
        if (this.useFollowCamera && this.targetObject) {
            // For now, using fixed lerpFactor. For frame-rate independent smoothing,
            // you could calculate an effectiveLerpFactor based on _deltaTime.
            // Example: const effectiveLerp = 1.0 - Math.exp(-SMOOTHING_CONSTANT * _deltaTime);
            this.updateFollowCameraLogic(this.cameraLerpFactor);
        } else {
            this.controls.update(); // Update OrbitControls if active
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