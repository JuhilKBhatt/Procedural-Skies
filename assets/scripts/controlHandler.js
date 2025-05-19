// controlHandler.js

export class ControlHandler {
    constructor(airplane) {
        this.airplane = airplane;
        this.keys = {};
        this.bindEvents();
    }

    bindEvents() {
        window.addEventListener('keydown', (event) => this.handleKeyDown(event));
        window.addEventListener('keyup', (event) => this.handleKeyUp(event));
    }

    handleKeyDown(event) {
        this.keys[event.key] = true;
        this.updateAirplane();
    }

    handleKeyUp(event) {
        this.keys[event.key] = false;
        this.updateAirplane();
    }

    updateAirplane() {
        if (!this.airplane) return;

        // Update speed
        if (this.keys['ArrowUp']) {
            this.airplane.speed = Math.min(this.airplane.speed + 0.01, this.airplane.maxSpeed);
            this.airplane.targetElevatorRotationX = 0.05;
        } else if (this.keys['ArrowDown']) {
            this.airplane.speed = Math.max(this.airplane.speed - 0.01, 0);
            this.airplane.targetElevatorRotationX = -0.05;
        } else {
            this.airplane.targetElevatorRotationX = 0;
        }

        // Update rotation
        if (this.keys['ArrowLeft']) {
            this.airplane.rotation.y += 0.05;
            this.airplane.targetRudderRotationZ = 0.5;
        } else if (this.keys['ArrowRight']) {
            this.airplane.rotation.y -= 0.05;
            this.airplane.targetRudderRotationZ = -0.5;
        } else {
            this.airplane.targetRudderRotationZ = 0;
        }
    }

    dispose() {
        window.removeEventListener('keydown', this.handleKeyDown);
        window.removeEventListener('keyup', this.handleKeyUp);
    }
}
