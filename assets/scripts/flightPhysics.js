// assets/scripts/flightPhysics.js (Conceptual - You need to implement this)
import * as CANNON from 'cannon-es';

export class FlightPhysics {
    constructor(physicsBody) {
        this.physicsBody = physicsBody;
        this.throttle = 0;      // 0 to 1
        this.yawControl = 0;    // -1 (left), 0 (neutral), 1 (right)
        this.pitchControl = 0;  // -1 (down), 0 (neutral), 1 (up)
        this.rollControl = 0;   // -1 (left), 0 (neutral), 1 (right)

        // --- Constants to be tuned ---
        this.maxThrust = 5000;         // Max engine thrust force (e.g., in Newtons)
        this.liftCoefficient = 1;   // Simplified lift coefficient
        this.dragCoefficient = 0;  // Simplified drag coefficient
        this.rudderEffectiveness = 300; // Torque effectiveness for yaw
        this.elevatorEffectiveness = 300;// Torque effectiveness for pitch
        this.aileronEffectiveness = 400; // Torque effectiveness for roll
        // --- End Constants ---

        // Helper vectors (to avoid allocations in loop)
        this.worldVelocity = new CANNON.Vec3();
        this.bodyForward = new CANNON.Vec3();
        this.bodyUp = new CANNON.Vec3();
        this.bodyRight = new CANNON.Vec3();
        this.forceVector = new CANNON.Vec3();
        this.torqueVector = new CANNON.Vec3();
        this.worldTorque = new CANNON.Vec3(); // Add this in constructor
    }

    setControls(controls) {
        if (controls.throttle !== undefined) this.throttle = Math.max(0, Math.min(1, controls.throttle));
        if (controls.yaw !== undefined) this.yawControl = controls.yaw;
        if (controls.pitch !== undefined) this.pitchControl = controls.pitch;
        if (controls.roll !== undefined) this.rollControl = controls.roll;
    }

    update(deltaTime) {
        const body = this.physicsBody;

        // Get current velocity and orientation in world frame
        this.worldVelocity.copy(body.velocity);
        const airspeed = this.worldVelocity.length();

        // Transform direction vectors from local to world space based on airplane's current orientation
        body.quaternion.vmult(CANNON.Vec3.UNIT_Z, this.bodyForward); // Z is forward
        body.quaternion.vmult(CANNON.Vec3.UNIT_Y, this.bodyUp);      // Y is up
        body.quaternion.vmult(CANNON.Vec3.UNIT_X, this.bodyRight);   // X is right

        // 1. Thrust (applied along the airplane's forward direction)
        const currentThrust = this.throttle * this.maxThrust;
        this.forceVector.copy(this.bodyForward).scale(currentThrust, this.forceVector);
        body.applyForce(this.forceVector, body.position); // Apply force at CM

        // 2. Lift (simplified: proportional to airspeed^2, acts along body's Up vector)
        // A more accurate model would use Angle of Attack.
        const liftMagnitude = this.liftCoefficient * airspeed * airspeed * (1.225); // 1.225 is air density
        this.forceVector.copy(this.bodyUp).scale(liftMagnitude, this.forceVector);
        body.applyForce(this.forceVector, body.position);

        // 3. Drag (simplified: proportional to airspeed^2, opposite to world velocity)
        if (airspeed > 0.1) { // Avoid issues at very low speed
            const dragMagnitude = this.dragCoefficient * airspeed * airspeed * (1.225);
            this.forceVector.copy(this.worldVelocity).scale(-1, this.forceVector).unit(this.forceVector).scale(dragMagnitude, this.forceVector);
            body.applyForce(this.forceVector, body.position);
        }

        // 4. Control Torques (applied in airplane's local frame)
        // Yaw (Rudder)
        this.torqueVector.set(0, this.yawControl * this.rudderEffectiveness, 0);
        body.quaternion.vmult(this.torqueVector, this.worldTorque);
        body.torque.vadd(this.worldTorque, body.torque);

        // Pitch (Elevators)
        this.torqueVector.set(this.pitchControl * this.elevatorEffectiveness, 0, 0);
        body.quaternion.vmult(this.torqueVector, this.worldTorque);
        body.torque.vadd(this.worldTorque, body.torque);

        // Roll (Ailerons)
        this.torqueVector.set(0, 0, this.rollControl * this.aileronEffectiveness);
        body.quaternion.vmult(this.torqueVector, this.worldTorque);
        body.torque.vadd(this.worldTorque, body.torque);

        // Optional: Add some angular damping if not using Cannon's built-in damping sufficiently
        // body.angularVelocity.scale(0.98, body.angularVelocity);
    }
}