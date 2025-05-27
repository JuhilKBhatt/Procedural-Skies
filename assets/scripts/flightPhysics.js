// assets/scripts/flightPhysics.js
import * as CANNON from 'cannon-es';

export class FlightPhysics {
    constructor(physicsBody) {
        this.physicsBody = physicsBody;

        // Control inputs (will be set via setControls method)
        this.throttle = 0.5; // Initial throttle (0 to 1)
        this.pitchControl = 0; // Elevator: positive for pitch up
        this.yawControl = 0;   // Rudder: positive for yaw right
        this.rollControl = 0;  // Ailerons: positive for roll right

        // Airplane characteristics (these are simplified and need tuning)
        this.maxThrust = 25000;
        this.liftCoefficient = 0.0000000000001;
        this.dragCoefficient = 0.0000000000001;
        
        this.pitchEffectiveness = 200000;
        this.yawEffectiveness = 200000;
        this.rollEffectiveness = 20000;

        this.airDensity = 9;
        this.speedForMaxControlEffectiveness = 0.1; // m/s
    }

    setControls(controls) {
        if (controls.throttle !== undefined) this.throttle = Math.max(0, Math.min(1, controls.throttle));
        if (controls.pitch !== undefined) this.pitchControl = controls.pitch;
        if (controls.yaw !== undefined) this.yawControl = controls.yaw;
        if (controls.roll !== undefined) this.rollControl = controls.roll;
    }

    update(deltaTime) {
        if (!this.physicsBody) return;

        const body = this.physicsBody;
        const velocity = body.velocity;
        const airspeed = velocity.length();
        const bodyQuaternion = body.quaternion; // Get the body's current orientation

        const airspeedFactor = Math.min(1.0, airspeed / this.speedForMaxControlEffectiveness);

        // --- Forces ---

        // a. Engine Thrust (Local Z-axis)
        const currentThrust = this.throttle * this.maxThrust;
        const thrustForceLocal = new CANNON.Vec3(0, 0, currentThrust);
        body.applyLocalForce(thrustForceLocal, new CANNON.Vec3(0, 0, 0));

        // b. Aerodynamic Lift (Local Y-axis)
        const liftMagnitude = this.liftCoefficient * this.airDensity * airspeed * airspeed;
        const liftForceLocal = new CANNON.Vec3(0, liftMagnitude, 0);
        body.applyLocalForce(liftForceLocal, new CANNON.Vec3(0, 0, 0));

        // c. Aerodynamic Drag (Opposes world velocity)
        if (airspeed > 0.01) {
            const dragMagnitude = this.dragCoefficient * this.airDensity * airspeed * airspeed;
            const dragForceWorld = velocity.clone().negate().unit().scale(dragMagnitude);
            body.applyForce(dragForceWorld, body.position);
        }

        // --- Torques (Applied in World Coordinates after conversion from Local) ---

        // a. Pitch (Elevator)
        // Local torque: around airplane's local X-axis (positive for pitch up)
        const pitchTorqueMagnitude = this.pitchControl * this.pitchEffectiveness * airspeedFactor;
        const localPitchTorqueVec = new CANNON.Vec3(pitchTorqueMagnitude, 0, 0);
        // Convert local torque to world torque
        const worldPitchTorqueVec = bodyQuaternion.vmult(localPitchTorqueVec);
        body.applyTorque(worldPitchTorqueVec);

        // b. Yaw (Rudder)
        // Local torque: around airplane's local Y-axis (positive for yaw right)
        const yawTorqueMagnitude = this.yawControl * this.yawEffectiveness * airspeedFactor;
        const localYawTorqueVec = new CANNON.Vec3(0, yawTorqueMagnitude, 0);
        // Convert local torque to world torque
        const worldYawTorqueVec = bodyQuaternion.vmult(localYawTorqueVec);
        body.applyTorque(worldYawTorqueVec);

        // c. Roll (Ailerons)
        // Local torque: around airplane's local Z-axis (positive for roll right)
        const rollTorqueMagnitude = this.rollControl * this.rollEffectiveness * airspeedFactor;
        const localRollTorqueVec = new CANNON.Vec3(0, 0, rollTorqueMagnitude);
        // Convert local torque to world torque
        const worldRollTorqueVec = bodyQuaternion.vmult(localRollTorqueVec);
        body.applyTorque(worldRollTorqueVec);

        //Log the forces and torques for debugging
        //console.log(`Pitch Torque: ${worldPitchTorqueVec}, Yaw Torque: ${worldYawTorqueVec}, Roll Torque: ${worldRollTorqueVec}`);
    }
}