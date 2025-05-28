// assets/scripts/flightPhysics.js
import * as CANNON from 'cannon-es';

export class FlightPhysics {
    constructor(physicsBody) {
        this.physicsBody = physicsBody;

        // Control inputs
        this.throttle = 0.5;
        this.pitchControl = 0;
        this.yawControl = 0;
        this.rollControl = 0;

        // Airplane characteristics
        this.maxThrust = 25000;
        this.liftCoefficient = 0.0000000000001;
        this.dragCoefficient = 0.0000000000001;
        
        this.pitchEffectiveness = 200000;
        this.yawEffectiveness = 200000;
        this.rollEffectiveness = 20000;

        this.airDensity = 9;
        this.speedForMaxControlEffectiveness = 0.1;
    }

    // Set control inputs from an object
    setControls(controls) {
        if (controls.throttle !== undefined) this.throttle = Math.max(0, Math.min(1, controls.throttle));
        if (controls.pitch !== undefined) this.pitchControl = controls.pitch;
        if (controls.yaw !== undefined) this.yawControl = controls.yaw;
        if (controls.roll !== undefined) this.rollControl = controls.roll;
    }

    // Update physics based on control inputs
    update(deltaTime) {
        if (!this.physicsBody) return;

        const body = this.physicsBody;
        const velocity = body.velocity;
        const airspeed = velocity.length();
        const bodyQuaternion = body.quaternion;

        const airspeedFactor = Math.min(1.0, airspeed / this.speedForMaxControlEffectiveness);

        // Engine Thrust
        const currentThrust = this.throttle * this.maxThrust;
        const thrustForceLocal = new CANNON.Vec3(0, 0, currentThrust);
        body.applyLocalForce(thrustForceLocal, new CANNON.Vec3(0, 0, 0));

        // Aerodynamic Lift
        const liftMagnitude = this.liftCoefficient * this.airDensity * airspeed * airspeed;
        const liftForceLocal = new CANNON.Vec3(0, liftMagnitude, 0);
        body.applyLocalForce(liftForceLocal, new CANNON.Vec3(0, 0, 0));

        // Aerodynamic Drag
        if (airspeed > 0.01) {
            const dragMagnitude = this.dragCoefficient * this.airDensity * airspeed * airspeed;
            const dragForceWorld = velocity.clone().negate().unit().scale(dragMagnitude);
            body.applyForce(dragForceWorld, body.position);
        }

        // Pitch
        const pitchTorqueMagnitude = this.pitchControl * this.pitchEffectiveness * airspeedFactor;
        const localPitchTorqueVec = new CANNON.Vec3(pitchTorqueMagnitude, 0, 0);
        const worldPitchTorqueVec = bodyQuaternion.vmult(localPitchTorqueVec);
        body.applyTorque(worldPitchTorqueVec);

        // Yaw
        const yawTorqueMagnitude = this.yawControl * this.yawEffectiveness * airspeedFactor;
        const localYawTorqueVec = new CANNON.Vec3(0, yawTorqueMagnitude, 0);
        const worldYawTorqueVec = bodyQuaternion.vmult(localYawTorqueVec);
        body.applyTorque(worldYawTorqueVec);

        // Roll
        const rollTorqueMagnitude = this.rollControl * this.rollEffectiveness * airspeedFactor;
        const localRollTorqueVec = new CANNON.Vec3(0, 0, rollTorqueMagnitude);
        const worldRollTorqueVec = bodyQuaternion.vmult(localRollTorqueVec);
        body.applyTorque(worldRollTorqueVec);

        //console.log(`Pitch Torque: ${worldPitchTorqueVec}, Yaw Torque: ${worldYawTorqueVec}, Roll Torque: ${worldRollTorqueVec}`);
    }
}