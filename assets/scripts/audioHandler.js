// assets/scripts/audioHandler.js

export class AudioHandler {
    constructor(soundPath, initialThrottle = 0.0) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.engineSoundSource = null;
        this.gainNode = this.audioContext.createGain();
        this.gainNode.connect(this.audioContext.destination);

        this.soundPath = soundPath;
        this.audioBuffer = null;
        this.isPlaying = false;
        this.isLoaded = false;

        // Audio Parameters
        this.minPlaybackRate = 0.4;  // Playback rate for engine idle
        this.maxPlaybackRate = 1.8;  // Playback rate for full throttle
        this.minGain = 0.05;         // Volume at idle
        this.maxGain = 0.7;          // Volume at full throttle
        this.smoothingTimeConstant = 0.1; // Time in seconds for smooth transitions

        this.currentThrottle = initialThrottle;
        this._loadSound().catch(error => console.error("AudioHandler: Error in initial sound load:", error));
    }

    async _loadSound() {
        if (!this.audioContext) {
            return;
        }
        // Check if soundPath is valid
        try {
            const response = await fetch(this.soundPath);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} for ${this.soundPath}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            this.isLoaded = true;

            // If an initial throttle was set and is > 0, try to start the sound
            if (this.currentThrottle > 0.01 && this.audioContext.state === 'running') {
                this.startEngineSound();
                this.updateThrottleSound(this.currentThrottle);
            }
        } catch (error) {
            this.isLoaded = false;
        }
    }

    startEngineSound() {
        if (!this.isLoaded || this.isPlaying || !this.audioBuffer) {
            return;
        }

        // Ensure AudioContext is running (might be suspended by browser)
        if (this.audioContext.state === 'suspended') {
            return;
        }

        this.engineSoundSource = this.audioContext.createBufferSource();
        this.engineSoundSource.buffer = this.audioBuffer;
        this.engineSoundSource.loop = true;
        this.engineSoundSource.connect(this.gainNode);
        this.engineSoundSource.start(0);
        this.isPlaying = true;
    }

    stopEngineSound() {
        if (this.engineSoundSource && this.isPlaying) {
            this.engineSoundSource.stop(0);
            this.engineSoundSource.disconnect();
            this.engineSoundSource = null;
            this.isPlaying = false;
        }
    }

    /**
     * Updates the engine sound based on the current throttle.
     * @param {number} throttle - A value between 0.0 (idle) and 1.0 (full throttle).
     */
    updateThrottleSound(throttle) {
        this.currentThrottle = Math.max(0, Math.min(1, throttle));

        if (!this.isLoaded) {
            return;
        }
        
        if (this.audioContext.state !== 'running') {
            return;
        }

        // Start sound if throttle is applied and not already playing
        if (this.currentThrottle > 0.01 && !this.isPlaying) {
            this.startEngineSound();
        } else if (this.currentThrottle <= 0.01 && this.isPlaying) {
            this.stopEngineSound();
            this.gainNode.gain.cancelScheduledValues(this.audioContext.currentTime);
            this.gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
            return;
        }

        // If sound is playing, update playback rate and gain
        if (this.isPlaying && this.engineSoundSource) {
            const targetPlaybackRate = this.minPlaybackRate + this.currentThrottle * (this.maxPlaybackRate - this.minPlaybackRate);
            this.engineSoundSource.playbackRate.setTargetAtTime(
                Math.max(0.01, targetPlaybackRate),
                this.audioContext.currentTime,
                this.smoothingTimeConstant
            );

            // Calculate target gain
            const targetGain = this.minGain + this.currentThrottle * (this.maxGain - this.minGain);
            this.gainNode.gain.setTargetAtTime(
                Math.max(0, targetGain),
                this.audioContext.currentTime,
                this.smoothingTimeConstant
            );
        }
    }

    // Resumes the AudioContext if it was suspended.
    async resumeContext() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            try {
                await this.audioContext.resume();
                if (this.isLoaded && this.currentThrottle > 0.01 && !this.isPlaying) {
                    this.startEngineSound();
                    this.updateThrottleSound(this.currentThrottle);
                }
            } catch (error) {}
        }
    }

    // Stops the engine sound and cleans up resources.
    dispose() {
        this.stopEngineSound();
        if (this.gainNode) {
            this.gainNode.disconnect();
        }
        if (this.audioContext) {
            this.audioContext.close().then(() => {
            }).catch(e => console.error("AudioHandler: Error closing AudioContext:", e));
        }
        this.isLoaded = false;
        this.isPlaying = false;
    }
}