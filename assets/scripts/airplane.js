// assets/scripts/airplane.js
import * as THREE from 'three';
import { loadFBXModel } from './LoadFBXModel.js'; // Assuming this file exists
import { animateAirplaneRudder, animateAirplaneElevator, animateAirplaneEngine } from './airplaneAnimate.js'; // Assuming this file exists
import { FlightPhysics } from './flightPhysics.js'; // Import the new class
import * as CANNON from 'cannon-es';

export function createAirplane(scene, world) {
    const modelPath = 'assets/models/plane/Airplane.fbx';
    const airplane = new THREE.Group();
    loadFBXModel(modelPath, new THREE.Vector3(0, 0, 0), airplane, 0.01); // Ensure this correctly loads and scales

    // Create a Cannon.js body for the airplane
    const airplaneBody = new CANNON.Body({
        mass: 1500, // Mass in kg (adjust as needed)
        position: new CANNON.Vec3(airplane.position.x, airplane.position.y, airplane.position.z),
        quaternion: new CANNON.Quaternion(airplane.quaternion.x, airplane.quaternion.y, airplane.quaternion.z, airplane.quaternion.w),
        linearDamping: 0.1,  // Basic air resistance / damping
        angularDamping: 0.5, // Stability damping
    });

    // Adjust shapes to better fit a typical airplane.
    // Cannon.js Box takes half-extents (half-width, half-height, half-depth).
    // Assuming: X is wingspan, Y is height, Z is length for the airplane model.
    const fuselageExtents = new CANNON.Vec3(1.5, 1.5, 7); // width/2, height/2, length/2
    airplaneBody.addShape(new CANNON.Box(fuselageExtents), new CANNON.Vec3(0, 0, 0)); // Centered fuselage

    const wingExtents = new CANNON.Vec3(8, 0.3, 2); // wingspan/2, thickness/2, chord/2
    airplaneBody.addShape(new CANNON.Box(wingExtents), new CANNON.Vec3(0, 0.5, -1)); // Wings slightly back and up

    // (Add more shapes for tail, etc. if desired for more accurate collision)

    airplane.physicsBody = airplaneBody;
    world.addBody(airplane.physicsBody);

    // Instantiate FlightPhysics
    airplane.flightPhysics = new FlightPhysics(airplane.physicsBody);

    // Rudder animation parameter (controls visual rudder mesh)
    airplane.targetRudderRotation = 0; // Assuming this is rotation around Y for rudder mesh

    // Elevator animation parameter (controls visual elevator mesh)
    airplane.targetElevatorRotation = 0; // Assuming this is rotation around X for elevator mesh

    // Aileron animation parameters (if you have aileron animations)
    airplane.targetLeftAileronRotation = 0;
    airplane.targetRightAileronRotation = 0;


    airplane.update = function (deltaTime) {
        // Update flight physics based on current control inputs
        this.flightPhysics.update(deltaTime);

        // Update visual animations
        this.animateRudder();
        this.animateElevator();
        this.animateEngine();
        // this.animateAilerons(); // If you add aileron animations
    };

    airplane.applyControl = function (control, value) {
        const controlsToSet = {};
        switch (control) {
            case 'throttle': // Value is 0-1
                controlsToSet.throttle = value;
                break;
            case 'yaw': // Rudder: ControlHandler sends 1 for left, -1 for right.
                        // FlightPhysics yawControl: -1 (left torque), 1 (right torque).
                        // If positive torque around Y means yaw right:
                controlsToSet.yaw = -value; // Invert if necessary based on torque direction
                this.targetRudderRotation = value * 0.5; // Max 0.5 rad for visual rudder
                break;
            case 'elevator': // Pitch: ControlHandler sends 1 for up, -1 for down.
                             // FlightPhysics pitchControl: -1 (pitch down torque), 1 (pitch up torque).
                             // If positive torque around X means pitch up:
                controlsToSet.pitch = value;
                this.targetElevatorRotation = -value * 0.4; // Max 0.4 rad for visual elevator (negative if model rotates opposite to control)
                break;
            case 'ailerons': // Roll: ControlHandler sends 1 for roll left, -1 for roll right.
                             // FlightPhysics rollControl: -1 (roll left torque), 1 (roll right torque).
                             // If positive torque around Z means roll right:
                controlsToSet.roll = -value;
                // For visual ailerons (e.g., left aileron up, right down for left roll)
                this.targetLeftAileronRotation = value * 0.3;
                this.targetRightAileronRotation = -value * 0.3;
                break;
        }
        this.flightPhysics.setControls(controlsToSet);
    };

    airplane.animateRudder = function () {
        animateAirplaneRudder(this, this.targetRudderRotation); // Pass target to animation function
    };

    airplane.animateElevator = function () {
        animateAirplaneElevator(this, this.targetElevatorRotation); // Pass target to animation function
    };

    airplane.animateEngine = function () {
        // Pass the current throttle from flightPhysics to the animation
        animateAirplaneEngine(this, this.flightPhysics.throttle);
    };

    //airplane.animateAilerons = function() {
    //    animateAirplaneAilerons(this, this.targetLeftAileronRotation, this.targetRightAileronRotation);
    //};

    scene.add(airplane);
    return airplane;
}