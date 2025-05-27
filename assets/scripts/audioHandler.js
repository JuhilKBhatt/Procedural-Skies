// assets/scripts/audioHandler.js

export class AudioHandler {
    constructor(soundPath, initialThrottle = 0.0) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.engineSoundSource = null;
        this.gainNode = this.audioContext.createGain();
        this.gainNode.connect(this.audioContext.destination);

        this.soundPath = soundPath; // e.g., './assets/sounds/engine_loop.ogg'
        this.audioBuffer = null;
        this.isPlaying = false;
        this.isLoaded = false;

        // --- Audio Parameters ---
        // Adjust these values to fine-tune the sound
        this.minPlaybackRate = 0.4;  // Playback rate for engine idle (lower pitch)
        this.maxPlaybackRate = 1.8;  // Playback rate for full throttle (higher pitch)
        this.minGain = 0.05;         // Volume at idle (must be > 0 to hear idle)
        this.maxGain = 0.7;          // Volume at full throttle
        this.smoothingTimeConstant = 0.1; // Time in seconds for smooth transitions

        this.currentThrottle = initialThrottle;

        // Start loading the sound immediately
        this._loadSound().catch(error => console.error("AudioHandler: Error in initial sound load:", error));
    }

    async _loadSound() {
        if (!this.audioContext) {
            console.warn("AudioHandler: AudioContext not available. Sound loading aborted.");
            return;
        }
        try {
            const response = await fetch(this.soundPath);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} for ${this.soundPath}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            this.isLoaded = true;
            console.log(`AudioHandler: Engine sound "${this.soundPath}" loaded successfully.`);

            // If an initial throttle was set and is > 0, try to start the sound
            if (this.currentThrottle > 0.01 && this.audioContext.state === 'running') {
                this.startEngineSound();
                this.updateThrottleSound(this.currentThrottle);
            }
        } catch (error) {
            console.error(`AudioHandler: Error loading engine sound from "${this.soundPath}":`, error);
            this.isLoaded = false;
        }
    }

    startEngineSound() {
        if (!this.isLoaded || this.isPlaying || !this.audioBuffer) {
            if (!this.isLoaded) console.warn("AudioHandler: Sound not loaded yet, cannot start.");
            return;
        }

        // Ensure AudioContext is running (might be suspended by browser)
        if (this.audioContext.state === 'suspended') {
            console.warn("AudioHandler: AudioContext is suspended. Call resumeContext() after user interaction.");
            return;
        }

        this.engineSoundSource = this.audioContext.createBufferSource();
        this.engineSoundSource.buffer = this.audioBuffer;
        this.engineSoundSource.loop = true;
        this.engineSoundSource.connect(this.gainNode);
        this.engineSoundSource.start(0); // Start playing immediately
        this.isPlaying = true;
        console.log("AudioHandler: Engine sound started.");
    }

    stopEngineSound() {
        if (this.engineSoundSource && this.isPlaying) {
            this.engineSoundSource.stop(0);
            this.engineSoundSource.disconnect(); // Disconnect from gainNode
            this.engineSoundSource = null;
            this.isPlaying = false;
            console.log("AudioHandler: Engine sound stopped.");
        }
    }

    /**
     * Updates the engine sound based on the current throttle.
     * @param {number} throttle - A value between 0.0 (idle) and 1.0 (full throttle).
     */
    updateThrottleSound(throttle) {
        this.currentThrottle = Math.max(0, Math.min(1, throttle)); // Clamp throttle to 0-1

        if (!this.isLoaded) {
            // Sound might still be loading, or failed to load.
            return;
        }
        
        if (this.audioContext.state !== 'running') {
            // Audio context not active, can't play or update sound.
            return;
        }

        // Start sound if throttle is applied and not already playing
        if (this.currentThrottle > 0.01 && !this.isPlaying) {
            this.startEngineSound();
        }
        // Stop sound if throttle is effectively zero and it is playing
        else if (this.currentThrottle <= 0.01 && this.isPlaying) {
            this.stopEngineSound();
            // Set gain to 0 immediately when stopping due to zero throttle
            this.gainNode.gain.cancelScheduledValues(this.audioContext.currentTime);
            this.gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
            return; // No further updates needed if stopped
        }

        if (this.isPlaying && this.engineSoundSource) {
            // Calculate target playback rate (pitch)
            const targetPlaybackRate = this.minPlaybackRate + this.currentThrottle * (this.maxPlaybackRate - this.minPlaybackRate);
            this.engineSoundSource.playbackRate.setTargetAtTime(
                Math.max(0.01, targetPlaybackRate), // Ensure playbackRate doesn't go to 0 or negative
                this.audioContext.currentTime,
                this.smoothingTimeConstant
            );

            // Calculate target gain (volume)
            const targetGain = this.minGain + this.currentThrottle * (this.maxGain - this.minGain);
            this.gainNode.gain.setTargetAtTime(
                Math.max(0, targetGain), // Ensure gain doesn't go negative
                this.audioContext.currentTime,
                this.smoothingTimeConstant
            );
        }
    }

    /**
     * Attempts to resume the AudioContext. Call this after a user interaction.
     */
    async resumeContext() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            try {
                await this.audioContext.resume();
                console.log("AudioHandler: AudioContext resumed successfully.");
                // If sound was supposed to be playing (based on currentThrottle), try starting it.
                if (this.isLoaded && this.currentThrottle > 0.01 && !this.isPlaying) {
                    this.startEngineSound();
                    this.updateThrottleSound(this.currentThrottle); // Apply current throttle settings
                }
            } catch (error) {
                console.error("AudioHandler: Error resuming AudioContext:", error);
            }
        }
    }

    /**
     * Cleans up audio resources.
     */
    dispose() {
        this.stopEngineSound();
        if (this.gainNode) {
            this.gainNode.disconnect();
        }
        if (this.audioContext) {
            // Closing the context is a good practice but can cause issues if other audio uses it.
            // If this AudioHandler is the sole user of its context, then it's safe.
            this.audioContext.close().then(() => {
                console.log("AudioHandler: AudioContext closed.");
            }).catch(e => console.error("AudioHandler: Error closing AudioContext:", e));
        }
        this.isLoaded = false;
        this.isPlaying = false;
    }
}