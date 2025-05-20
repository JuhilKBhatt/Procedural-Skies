// airplane.js
import * as THREE from 'three';
import { loadFBXModel } from './LoadFBXModel.js';
import { animateAirplaneRudder, animateAirplaneElevator, animateAirplaneEngine } from './airplaneAnimate.js';
import { FlightPhysics } from './flightPhysics.js';
import * as CANNON from 'cannon-es';

export function createAirplane(scene, world) {
    const modelPath = 'assets/models/plane/Airplane.fbx';
    const airplane = new THREE.Group();
    loadFBXModel(modelPath, new THREE.Vector3(0, 0, 0), airplane, 0.02);
    airplane.position.set(0, 100, -180);
    airplane.quaternion.setFromEuler(new THREE.Euler(0, Math.PI, 0)); // Adjust initial orientation if needed

    // Movement parameters are now handled by FlightPhysics
    airplane.speed = 0; // Throttle (0 to 1)

    // Rudder animation parameter
    airplane.targetRudderRotationZ = 0;

    // Elevator animation parameter
    airplane.targetElevatorRotationX = 0;

    // Update airplane based on physics
    airplane.update = function (deltaTime) {
        this.animateRudder();
        this.animateElevator();
        this.animateEngine();
    };

    // Apply control inputs
    airplane.applyControl = function (control, value) {
        switch (control) {
            case 'rudder':
                this.targetRudderRotationZ = value; // Value between -1 and 1
                break;
            case 'elevator':
                this.targetElevatorRotationX = value; // Value between -1 and 1
                break;
            case 'throttle':
                this.speed = value;
                break;
            case 'ailerons':
                break;
        }
    };

    // Animate airplane rudder by calling the imported function
    airplane.animateRudder = function () {
        animateAirplaneRudder(this);
    };

    // Animate airplane elevator by calling the imported function
    airplane.animateElevator = function () {
        animateAirplaneElevator(this);
    };

    // Animate airplane engine
    airplane.animateEngine = function () {
        animateAirplaneEngine(this, this.speed);
    };

    // Create a Cannon.js body for the airplane
    const airplaneShape = new CANNON.Box(new CANNON.Vec3(30, 10, 60)); // Adjust dimensions as needed
// Create a compound Cannon.js body for the airplane
    const airplaneBody = new CANNON.Body({
        mass: 1, // Adjust mass as needed
        position: new CANNON.Vec3(airplane.position.x, airplane.position.y, airplane.position.z),
        quaternion: new CANNON.Quaternion(airplane.quaternion.x, airplane.quaternion.y, airplane.quaternion.z, airplane.quaternion.w)
    });

    // Fuselage (center box)
    const fuselageShape = new CANNON.Box(new CANNON.Vec3(60, 60, 60));
    airplaneBody.addShape(fuselageShape, new CANNON.Vec3(0, 0, 0)); // Offset 0

    // Wings (example - adjust dimensions and offsets)
    const wingShape = new CANNON.Box(new CANNON.Vec3(60, 1, 5)); // Thin wing
    airplaneBody.addShape(wingShape, new CANNON.Vec3(0, 10, 0)); // Above fuselage - adjust offset and orientation
    airplaneBody.addShape(wingShape, new CANNON.Vec3(0, -10, 0)); // Below fuselage - adjust offset and orientation

    airplane.physicsBody = airplaneBody;
    world.addBody(airplane.physicsBody);

    scene.add(airplane);
    return airplane;
}