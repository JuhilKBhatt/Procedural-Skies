// perlinNoise.js
class PerlinNoise {
    constructor(seed = Math.random()) {
        this.p = new Uint8Array(512);
        this.seed = seed;
        this._initializePermutationTable();
    }

    _initializePermutationTable() {
        let random = () => {
            // Simple linear congruential generator for deterministic randomness based on seed
            const a = 1103515245;
            const c = 12345;
            const m = 2**31 - 1; // A large prime
            this.seed = (a * this.seed + c) % m;
            return this.seed / m; // Normalize to [0, 1)
        };

        const pTable = new Uint8Array(256);
        for (let i = 0; i < 256; i++) {
            pTable[i] = i;
        }

        // Fisher-Yates Shuffle
        for (let i = 255; i > 0; i--) {
            const j = Math.floor(random() * (i + 1));
            [pTable[i], pTable[j]] = [pTable[j], pTable[i]];
        }

        for (let i = 0; i < 256; i++) {
            this.p[i] = this.p[i + 256] = pTable[i];
        }
    }

    _fade(t) {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }

    _lerp(t, a, b) {
        return a + t * (b - a);
    }

    _grad3D(hash, x, y, z) {
        const h = hash & 15;
        const u = h < 8 ? x : y;
        const v = h < 4 ? y : (h === 12 || h === 14 ? x : z);
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }

    noise3D(x, y, z) {
        let X = Math.floor(x) & 255;
        let Y = Math.floor(y) & 255;
        let Z = Math.floor(z) & 255;
        x -= Math.floor(x);
        y -= Math.floor(y);
        z -= Math.floor(z);
        const u = this._fade(x);
        const v = this._fade(y);
        const w = this._fade(z);
        const A = this.p[X] + Y;
        const AA = this.p[A] + Z;
        const AB = this.p[A + 1] + Z;
        const B = this.p[X + 1] + Y;
        const BA = this.p[B] + Z;
        const BB = this.p[B + 1] + Z;

        return this._lerp(w, this._lerp(v, this._lerp(u, this._grad3D(this.p[AA], x, y, z), this._grad3D(this.p[BA], x - 1, y, z)), this._lerp(u, this._grad3D(this.p[AB], x, y - 1, z), this._grad3D(this.p[BB], x - 1, y - 1, z))),
            this._lerp(v, this._lerp(u, this._grad3D(this.p[AA + 1], x, y, z - 1), this._grad3D(this.p[BA + 1], x - 1, y, z - 1)), this._lerp(u, this._grad3D(this.p[AB + 1], x, y - 1, z - 1), this._grad3D(this.p[BB + 1], x - 1, y - 1, z - 1))));
    }
}

// Instantiate Perlin Noise with a fixed seed for repeatable terrain
const perlin = new PerlinNoise(12345); // Use a seed for reproducibility

// Base multi-octave noise generation
function multiOctavePerlinNoise3D(x, y, z, octaves = 6, persistence = 0.5, lacunarity = 2.0) {
    let total = 0;
    let frequency = 1.0;
    let amplitude = 1.0;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
        total += perlin.noise3D(x * frequency, y * frequency, z * frequency) * amplitude;
        maxValue += amplitude;
        amplitude *= persistence;
        frequency *= lacunarity;
    }

    // Normalize to [0, 1]
    return (total / maxValue + 1) / 2;
}

// Generate noise for mountainous terrain
function generateMountainNoise(x, y, z) {
    // Parameters for mountainous terrain (higher octaves, persistence)
    return multiOctavePerlinNoise3D(x, y, z, 8, 0.6, 2.0);
}

// Generate noise for plains terrain
function generatePlainsNoise(x, y, z) {
    // Parameters for flatter terrain (fewer octaves, lower persistence)
    return multiOctavePerlinNoise3D(x, y, z, 4, 0.3, 2.0);
}

// Generate noise to act as a terrain type map (smooth transitions between plains and mountains)
function generateTerrainTypeNoise(x, y, z) {
    // Large-scale noise with fewer octaves and low persistence for smooth transitions
    return multiOctavePerlinNoise3D(x * 0.1, y * 0.1, z * 0.1, 3, 0.4, 2.0);
}

// Generate noise for river potential (using absolute value to create ridges/valleys)
function generateRiverMaskNoise(x, y, z) {
    // Use higher frequency and take absolute value to create sharper, channel-like features
    // Subtracting from 1 and taking abs makes the valleys (low noise) the potential river areas
    return Math.abs(multiOctavePerlinNoise3D(x * 0.5, y * 0.5, z * 0.5, 6, 0.5, 2.0) * 2 - 1); // Map to [-1, 1] before abs
}


// Main function to combine different terrain types and rivers
export function generateCombinedTerrain(x, y, z, mountain_threshold = 0.6, river_threshold = 0.1, river_depth = 0.15) {
    // Get terrain type value (0 to 1)
    const terrainType = generateTerrainTypeNoise(x, y, z);

    let terrainHeight;

    // Interpolate between plains and mountain noise based on terrain type
    if (terrainType < mountain_threshold) {
        // Mostly plains, but can blend towards mountains as terrainType approaches threshold
        const blend = terrainType / mountain_threshold; // 0 to 1 as terrainType goes from 0 to mountain_threshold
        terrainHeight = this._lerp(blend, generatePlainsNoise(x, y, z), generateMountainNoise(x, y, z));
    } else {
        // Mostly mountains, but can blend from plains as terrainType exceeds threshold
        const blend = (terrainType - mountain_threshold) / (1.0 - mountain_threshold); // 0 to 1 as terrainType goes from mountain_threshold to 1
         terrainHeight = this._lerp(blend, generatePlainsNoise(x, y, z), generateMountainNoise(x, y, z));
    }

    // Generate river mask value (0 to 1, where lower values are potential river areas)
    const riverMask = generateRiverMaskNoise(x, y, z);

    // Apply river carving
    if (riverMask < river_threshold) {
        const riverInfluence = 1.0 - (riverMask / river_threshold);
        terrainHeight -= riverInfluence * river_depth;
        terrainHeight = Math.max(terrainHeight, 0);
    }

     return Math.max(0, Math.min(1, terrainHeight));
}