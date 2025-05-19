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

        // Update throttle
        if (this.keys['ArrowUp']) {
            this.airplane.applyControl('throttle', Math.min(1, this.airplane.speed + 0.02)); // Increase throttle
            this.airplane.applyControl('elevator', 1); // Apply some elevator for takeoff
        } else if (this.keys['ArrowDown']) {
            this.airplane.applyControl('throttle', Math.max(0, this.airplane.speed - 0.02)); // Decrease throttle
            this.airplane.applyControl('elevator', -1); // Apply some down elevator
        } else {
            this.airplane.applyControl('elevator', 0); // Neutral elevator
        }

        // Update yaw (rudder)
        if (this.keys['ArrowLeft']) {
            this.airplane.applyControl('yaw', 1); // Yaw left
        } else if (this.keys['ArrowRight']) {
            this.airplane.applyControl('yaw', -1); // Yaw right
        } else {
            this.airplane.applyControl('yaw', 0); // Neutral yaw
        }

        // Example for ailerons (roll) - you might need different keys
        if (this.keys['q']) {
            this.airplane.applyControl('ailerons', 1); // Roll left
        } else if (this.keys['e']) {
            this.airplane.applyControl('ailerons', -1); // Roll right
        } else {
            this.airplane.applyControl('ailerons', 0); // Neutral roll
        }
    }

    dispose() {
        window.removeEventListener('keydown', this.handleKeyDown);
        window.removeEventListener('keyup', this.handleKeyUp);
    }
}