// flightPhysics.js
import * as THREE from 'three';

export class FlightPhysics {
    constructor(airplane, initialConfig = {}) {
        this.airplane = airplane;
        this.config = {
            gravity: -9.8 * 10, // Scaled gravity
            airDensity: 1.225, // kg/m^3
            wingArea: 20, // m^2 (example value)
            liftCoefficientSlope: 0.1, // Lift coefficient per degree of angle of attack (example)
            maxCl: 1.5, // Maximum lift coefficient (example)
            dragCoefficientFactor: 0.01, // Factor for drag coefficient (example)
            thrustMultiplier: 5000, // Adjust for desired thrust force
            ...initialConfig,
        };

        this.angleOfAttack = 0;
        this.pitch = 0;
        this.yaw = 0;
        this.roll = 0;

        this.velocity = new THREE.Vector3();
        this.acceleration = new THREE.Vector3();
        this.liftForce = new THREE.Vector3();
        this.dragForce = new THREE.Vector3();
        this.thrustForce = new THREE.Vector3();
        this.gravityForce = new THREE.Vector3(0, this.config.gravity * this.getMass(), 0);
    }

    getMass() {
        // Approximate mass based on model scale (you might need to adjust this)
        return 1000; // kg (example value)
    }

    update(deltaTime) {
        this.calculateForces();
        this.updateMotion(deltaTime);
        this.applyForcesToAirplane();
    }

    calculateForces() {
        this.calculateLift();
        this.calculateDrag();
        this.calculateThrust();
    }

    calculateLift() {
        const forwardDirection = new THREE.Vector3(0, 0, 1).applyQuaternion(this.airplane.quaternion).normalize();
        const upDirection = new THREE.Vector3(0, 1, 0).applyQuaternion(this.airplane.quaternion).normalize();
        const velocityWorld = this.velocity.clone().applyQuaternion(this.airplane.quaternion);
        const relativeVelocity = velocityWorld.clone().multiplyScalar(-1); // Velocity of air relative to the wing

        const speedSquared = relativeVelocity.lengthSq();
        if (speedSquared < 0.1) {
            this.liftForce.set(0, 0, 0);
            return;
        }
        const speed = Math.sqrt(speedSquared);

        // Approximate angle of attack (simplified)
        const velocityVertical = relativeVelocity.clone().projectOnVector(upDirection);
        const velocityHorizontal = relativeVelocity.clone().projectOnPlane(upDirection);

        if (velocityHorizontal.lengthSq() > 0.001) {
            this.angleOfAttack = Math.atan2(velocityVertical.length(), velocityHorizontal.length()) * (180 / Math.PI);
            if (forwardDirection.dot(velocityHorizontal) < 0) {
                this.angleOfAttack *= -1;
            }
        } else {
            this.angleOfAttack = 0;
        }


        let cl = this.config.liftCoefficientSlope * this.angleOfAttack;
        cl = Math.min(Math.max(cl, -this.config.maxCl), this.config.maxCl); // Clamp lift coefficient

        const liftMagnitude = 0.5 * this.config.airDensity * speedSquared * this.config.wingArea * cl;
        this.liftForce.copy(upDirection).multiplyScalar(liftMagnitude);
    }

    calculateDrag() {
        const velocityWorld = this.velocity.clone().applyQuaternion(this.airplane.quaternion);
        const speedSquared = velocityWorld.lengthSq();
        if (speedSquared < 0.1) {
            this.dragForce.set(0, 0, 0);
            return;
        }
        const speed = Math.sqrt(speedSquared);

        // Approximate drag coefficient (simplified - could be more complex based on angle of attack etc.)
        const cd = this.config.dragCoefficientFactor * speed;

        const dragMagnitude = 0.5 * this.config.airDensity * speedSquared * this.config.wingArea * cd;
        const dragDirection = velocityWorld.clone().normalize().multiplyScalar(-1);
        this.dragForce.copy(dragDirection).multiplyScalar(dragMagnitude);
    }

    calculateThrust() {
        const forwardDirection = new THREE.Vector3(0, 0, 1).applyQuaternion(this.airplane.quaternion).normalize();
        this.thrustForce.copy(forwardDirection).multiplyScalar(this.airplane.speed * this.config.thrustMultiplier);
    }

    updateMotion(deltaTime) {
        // Net force
        const netForce = new THREE.Vector3()
            .add(this.gravityForce)
            .add(this.liftForce)
            .add(this.dragForce)
            .add(this.thrustForce);

        // Acceleration (F = ma => a = F/m)
        const mass = this.getMass();
        this.acceleration.copy(netForce).divideScalar(mass);

        // Update velocity (v = v0 + a*t)
        this.velocity.add(this.acceleration.clone().multiplyScalar(deltaTime));

        // Apply some damping to prevent infinite speed buildup (optional)
        this.velocity.multiplyScalar(0.995);
    }

    applyForcesToAirplane() {
        this.airplane.position.add(this.velocity.clone().multiplyScalar(0.01666)); // Assuming ~60 FPS for deltaTime compensation

        // Apply rotation based on user input (rudder, elevator, ailerons would control rotation)
        this.airplane.rotation.y += this.yaw * 0.02;
        this.airplane.rotation.x += this.pitch * 0.02;
        this.airplane.rotation.z = this.roll * 0.02; // Simple roll

        // Reset rotation inputs for the next frame
        this.pitch = 0;
        this.yaw = 0;
        this.roll = 0;
    }

    applyControl(control, value) {
        switch (control) {
            case 'pitch':
                this.pitch = value;
                break;
            case 'yaw':
                this.yaw = value;
                break;
            case 'roll':
                this.roll = value;
                break;
            case 'throttle':
                this.airplane.speed = value; // Assuming 'value' is between 0 and 1
                break;
        }
    }
}