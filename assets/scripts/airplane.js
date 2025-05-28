// assets/scripts/airplane.js
import * as THREE from 'three';
import { loadFBXModel } from './LoadFBXModel.js';
import { animateAirplaneRudder, animateAirplaneElevator, animateAirplaneEngine } from './airplaneAnimate.js';
import { FlightPhysics } from './flightPhysics.js';
import * as CANNON from 'cannon-es';

export function createAirplane(scene, world) {
    const modelPath = 'assets/models/plane/Airplane.fbx';
    const airplane = new THREE.Group();
    loadFBXModel(modelPath, new THREE.Vector3(0, 0, 0), airplane, 0.01);

    // Create a Cannon.js body for the airplane
    const airplaneBody = new CANNON.Body({
        mass: 1500, // Mass in kg
        position: new CANNON.Vec3(airplane.position.x, airplane.position.y, airplane.position.z),
        quaternion: new CANNON.Quaternion(airplane.quaternion.x, airplane.quaternion.y, airplane.quaternion.z, airplane.quaternion.w),
        linearDamping: 0.1,  // Basic air resistance
        angularDamping: 0.5, // Stability damping
    });

    // Adjust shapes to better fit a typical airplane.
    const fuselageExtents = new CANNON.Vec3(1.5, 1.5, 7);
    airplaneBody.addShape(new CANNON.Box(fuselageExtents), new CANNON.Vec3(0, 0, 0));
    const wingExtents = new CANNON.Vec3(8, 0.3, 2);
    airplaneBody.addShape(new CANNON.Box(wingExtents), new CANNON.Vec3(0, 0.5, -1));

    airplane.physicsBody = airplaneBody;
    world.addBody(airplane.physicsBody);

    // Init FlightPhysics
    airplane.flightPhysics = new FlightPhysics(airplane.physicsBody);

    // Rudder animation parameter
    airplane.targetRudderRotation = 0;

    // Elevator animation parameter
    airplane.targetElevatorRotation = 0;

    // Aileron animation parameters
    airplane.targetLeftAileronRotation = 0;
    airplane.targetRightAileronRotation = 0;


    airplane.update = function (deltaTime) {
        // Update flight physics based on current control inputs
        this.flightPhysics.update(deltaTime);

        // Update visual animations
        this.animateRudder();
        this.animateElevator();
        this.animateEngine();
    };

    airplane.applyControl = function (control, value) {
        const controlsToSet = {};
        switch (control) {
            case 'throttle':
                controlsToSet.throttle = value;
                break;
            case 'yaw':
                controlsToSet.yaw = -value;
                this.targetRudderRotation = value * 0.5;
                break;
            case 'elevator':
                controlsToSet.pitch = value;
                this.targetElevatorRotation = -value * 0.4;
                break;
            case 'ailerons':
                controlsToSet.roll = -value;
                this.targetLeftAileronRotation = value * 0.3;
                this.targetRightAileronRotation = -value * 0.3;
                break;
        }
        this.flightPhysics.setControls(controlsToSet);
    };

    airplane.animateRudder = function () {
        animateAirplaneRudder(this, this.targetRudderRotation);
    };

    airplane.animateElevator = function () {
        animateAirplaneElevator(this, this.targetElevatorRotation);
    };

    airplane.animateEngine = function () {
        animateAirplaneEngine(this, this.flightPhysics.throttle);
    };

    scene.add(airplane);
    return airplane;
}