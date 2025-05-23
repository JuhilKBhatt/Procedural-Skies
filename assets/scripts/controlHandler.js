// assets/scripts/controlHandler.js
export class ControlHandler {
    constructor(airplane) {
        this.airplane = airplane;
        this.keys = {};

        // Store current throttle state locally in ControlHandler
        this.currentThrottle = 0.1; // Initial throttle is 10% for takeoff
        if (this.airplane && this.airplane.flightPhysics) {
            this.currentThrottle = this.airplane.flightPhysics.throttle; // Sync with physics if already set
        }
        this.throttleStep = 0.05; // Smoother throttle adjustment

        this.bindEvents();
        this.updateAirplane(); // Initialize controls (especially neutrals)
    }

    bindEvents() {
        // Using arrow functions to preserve 'this' context
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleKeyUp = this.handleKeyUp.bind(this);

        window.addEventListener('keydown', this.handleKeyDown);
        window.addEventListener('keyup', this.handleKeyUp);
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
        if (!this.airplane || !this.airplane.flightPhysics) return;

        let newThrottle = this.currentThrottle;
        let elevatorInput = 0;
        let yawInput = 0;
        let aileronInput = 0;

        // Update throttle
        if (this.keys['ArrowUp']) {
            newThrottle = Math.min(1, this.currentThrottle + this.throttleStep);
            // Apply some elevator for takeoff assist, reduce as speed increases or make it conditional
            elevatorInput = 0.3;
        } else if (this.keys['ArrowDown']) {
            newThrottle = Math.max(0, this.currentThrottle - this.throttleStep);
            elevatorInput = -0.1; // Less aggressive down elevator
        }
        this.currentThrottle = newThrottle;
        this.airplane.applyControl('throttle', this.currentThrottle);

        // Update elevator (can be overridden by specific pitch keys if added)
        // If 'w' or 's' are intended for direct pitch control:
        if (this.keys['w']) {
            elevatorInput = 0.1; // Pitch up
        } else if (this.keys['s']) {
            elevatorInput = -0.1; // Pitch down
        } else if (!this.keys['ArrowUp'] && !this.keys['ArrowDown']) {
            // Neutral elevator if no throttle/pitch keys are pressed
            elevatorInput = 0;
        }
        this.airplane.applyControl('elevator', elevatorInput);


        // Update yaw (rudder)
        if (this.keys['a']) {
            yawInput = 0.05; // Yaw left
        } else if (this.keys['d']) {
            yawInput = -0.05; // Yaw right
        }
        this.airplane.applyControl('yaw', yawInput);

        // Update roll (ailerons)
        if (this.keys['q']) { // Changed from 'a' to 'q' as in original
            aileronInput = 1; // Roll left
        } else if (this.keys['e']) { // Changed from 'd' to 'e' as in original
            aileronInput = -1; // Roll right
        }
        this.airplane.applyControl('ailerons', aileronInput);
    }

    dispose() {
        window.removeEventListener('keydown', this.handleKeyDown);
        window.removeEventListener('keyup', this.handleKeyUp);
    }
}