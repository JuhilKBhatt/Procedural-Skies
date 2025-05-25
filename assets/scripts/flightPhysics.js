// assets/scripts/flightPhysics.js
import * as CANNON from 'cannon-es';
import * as THREE from 'three'; // For THREE.Vector3 if needed for utility

export class FlightPhysics {
    constructor(airplaneBody) {
        this.airplaneBody = airplaneBody;
        console.log("FlightPhysics initialized with body:", airplaneBody);


        // --- Aerodynamic Properties (tune these for desired flight characteristics) ---
        this.airDensity = 1.225; // kg/m^3 (at sea level)
        this.wingArea = 15;      // m^2 (effective wing area)
        this.fuselageArea = 5;   // m^2 (for parasitic drag)

        // Lift Coefficients
        this.baseLiftCoefficient = 0.1;
        this.liftCoefficientSlope = 0.1; // Per degree
        this.maxLiftCoefficient = 1.4;
        this.stallAngle = 15;        // Degrees
        this.postStallLiftSlope = -0.05;

        // Drag Coefficients
        this.baseDragCoefficient = 0.02;
        this.inducedDragFactor = 0.01;

        // Engine Properties
        this.maxThrust = 30000; // N
        this.engineEfficiency = 0.8;

        // Control Surface Effectiveness
        this.elevatorEffectiveness = 0.05;
        this.aileronEffectiveness = 0.06;
        this.rudderEffectiveness = 0.04;
        this.stabilizerEffectiveness = 0.005;

        // --- Current State ---
        this.throttle = 0.1; // Initial throttle
        this.pitchControl = 0;
        this.rollControl = 0;
        this.yawControl = 0;

        this.airspeed = 0;
        this.angleOfAttack = 0;
        this.sideslipAngle = 0;

        this.logCounter = 0; // For periodic logging
    }

    setControls(controls) {
        if (controls.throttle !== undefined) this.throttle = Math.max(0, Math.min(1, controls.throttle));
        if (controls.pitch !== undefined) this.pitchControl = controls.pitch;
        if (controls.roll !== undefined) this.rollControl = controls.roll;
        if (controls.yaw !== undefined) this.yawControl = controls.yaw;
    }

    update(deltaTime) {
        if (!this.airplaneBody || !this.airplaneBody.world) { // Ensure body is in a world
            console.warn("Airplane body not available or not in a world for FlightPhysics update.");
            return;
        }

        const velocity = this.airplaneBody.velocity;
        const quaternion = this.airplaneBody.quaternion;

        const worldVelocityVec = new CANNON.Vec3(velocity.x, velocity.y, velocity.z);
        this.airspeed = worldVelocityVec.length();

        const localVelocity = this.airplaneBody.vectorToLocalFrame(worldVelocityVec);

        if (this.airspeed > 0.1) { // Increased threshold slightly for more stable AoA calculation
            this.angleOfAttack = Math.atan2(-localVelocity.y, -localVelocity.z) * (180 / Math.PI);
            this.sideslipAngle = Math.atan2(localVelocity.x, -localVelocity.z) * (180 / Math.PI);
        } else {
            this.angleOfAttack = 0;
            this.sideslipAngle = 0;
        }

        let currentLiftCoefficient = this.baseLiftCoefficient + this.angleOfAttack * this.liftCoefficientSlope;
        if (Math.abs(this.angleOfAttack) > this.stallAngle) {
            const overshoot = Math.abs(this.angleOfAttack) - this.stallAngle;
            currentLiftCoefficient = this.maxLiftCoefficient + overshoot * this.postStallLiftSlope;
        }
        currentLiftCoefficient = Math.max(0, Math.min(currentLiftCoefficient, this.maxLiftCoefficient));

        let groundEffectMultiplier = 1.0;
        const altitude = this.airplaneBody.position.y;
        // A more common estimation for wingspan from area 'A' and aspect ratio 'AR': span = sqrt(A*AR)
        // Assuming an aspect ratio of ~6 for estimation: 6 * 15 = 90. sqrt(90) approx 9.5m. Let's use a fixed reasonable value or make it a property.
        const estimatedWingspan = 9.5; // meters, rough estimate based on 15m^2 area
        if (altitude < estimatedWingspan * 1.5 && altitude > 0) {
            groundEffectMultiplier = 1 + (1 - (altitude / (estimatedWingspan * 1.5))) * 0.3;
        }

        const liftForceMagnitude = 0.5 * this.airDensity * this.airspeed * this.airspeed * this.wingArea * currentLiftCoefficient * groundEffectMultiplier;
        const localLiftDirection = new CANNON.Vec3(0, 1, 0);
        const liftForce = localLiftDirection.scale(liftForceMagnitude);

        const parasiticDrag = 0.5 * this.airDensity * this.airspeed * this.airspeed * this.fuselageArea * this.baseDragCoefficient;
        let inducedDrag = 0;
        if (this.airspeed > 0.1 && this.wingArea > 0) { // Avoid division by zero if airspeed or wingArea is zero
             inducedDrag = this.inducedDragFactor * liftForceMagnitude * liftForceMagnitude / (0.5 * this.airDensity * this.airspeed * this.airspeed * this.wingArea);
        }
        const totalDragMagnitude = parasiticDrag + inducedDrag;
        const localDragDirection = localVelocity.lengthSquared() > 1e-6 ? localVelocity.clone().negate().unit() : new CANNON.Vec3(0,0,0);
        const dragForce = localDragDirection.scale(totalDragMagnitude);

        const thrustMagnitude = this.throttle * this.maxThrust * this.engineEfficiency;
        const localThrustForce = new CANNON.Vec3(0, 0, 1).scale(thrustMagnitude);

        const speedSquared = this.airspeed * this.airspeed;
        const pitchTorqueMagnitude = this.pitchControl * speedSquared * this.elevatorEffectiveness;
        const localPitchTorque = new CANNON.Vec3(pitchTorqueMagnitude, 0, 0);

        const rollTorqueMagnitude = this.rollControl * speedSquared * this.aileronEffectiveness;
        const localRollTorque = new CANNON.Vec3(0, 0, rollTorqueMagnitude);

        const yawTorqueMagnitude = this.yawControl * speedSquared * this.rudderEffectiveness;
        const localYawTorque = new CANNON.Vec3(0, yawTorqueMagnitude, 0);

        this.airplaneBody.applyLocalForce(liftForce, CANNON.Vec3.ZERO); // Apply at CG
        this.airplaneBody.applyLocalForce(dragForce, CANNON.Vec3.ZERO); // Apply at CG
        this.airplaneBody.applyLocalForce(localThrustForce, new CANNON.Vec3(0, 0, -0.5)); // Thrust slightly behind CG

        const totalLocalControlTorque = new CANNON.Vec3();
        totalLocalControlTorque.vadd(localPitchTorque, totalLocalControlTorque);
        totalLocalControlTorque.vadd(localRollTorque, totalLocalControlTorque);
        totalLocalControlTorque.vadd(localYawTorque, totalLocalControlTorque);

        if (totalLocalControlTorque.lengthSquared() > 1e-9) { // Only apply if there's significant torque
            const worldControlTorque = this.airplaneBody.quaternion.vmult(totalLocalControlTorque);
            this.airplaneBody.applyTorque(worldControlTorque);
        }

        const localAngularVelocity = this.airplaneBody.vectorToLocalFrame(this.airplaneBody.angularVelocity);
        const stabilityPitchTorqueMag = -localAngularVelocity.x * Math.abs(localAngularVelocity.x) * this.stabilizerEffectiveness * 5;
        const stabilityRollTorqueMag  = -localAngularVelocity.z * Math.abs(localAngularVelocity.z) * this.stabilizerEffectiveness;
        const stabilityYawTorqueMag   = -localAngularVelocity.y * Math.abs(localAngularVelocity.y) * this.stabilizerEffectiveness;
        const localStabilityTorque = new CANNON.Vec3(stabilityPitchTorqueMag, stabilityYawTorqueMag, stabilityRollTorqueMag);

        if (localStabilityTorque.lengthSquared() > 1e-9) {
            const worldStabilityTorque = this.airplaneBody.quaternion.vmult(localStabilityTorque);
            this.airplaneBody.applyTorque(worldStabilityTorque);
        }

        this.logCounter++;
        if (this.logCounter % 120 === 0) { // Log roughly every 2 seconds (assuming 60fps)
            console.log(`Physics Update - Pos: ${this.airplaneBody.position.y.toFixed(2)}, Airspeed: ${this.airspeed.toFixed(2)}, AoA: ${this.angleOfAttack.toFixed(2)}`);
            console.log(`Forces - Lift: ${liftForceMagnitude.toFixed(0)}, Drag: ${totalDragMagnitude.toFixed(0)}, Thrust: ${thrustMagnitude.toFixed(0)}`);
            if (totalLocalControlTorque.lengthSquared() > 1e-9) {
                console.log(`CtrlTorque L: ${localPitchTorque.x.toFixed(1)},${localYawTorque.y.toFixed(1)},${localRollTorque.z.toFixed(1)}`);
            }
            if (localStabilityTorque.lengthSquared() > 1e-9) {
                 console.log(`StabTorque L: ${localStabilityTorque.x.toFixed(1)},${localStabilityTorque.y.toFixed(1)},${localStabilityTorque.z.toFixed(1)}`);
            }
            // Check for NaN physics body properties
            if (isNaN(this.airplaneBody.position.x) || isNaN(this.airplaneBody.quaternion.x)) {
                console.error("!!! Physics body has NaN values !!!");
            }
        }
    }
}