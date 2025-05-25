// perlinNoise.js

// Standalone lerp function
function lerp(t, a, b) {
    return a + t * (b - a);
}

class PerlinNoise {
    constructor(seed = Math.random()) {
        this.p = new Uint8Array(1024);
        this.seed = seed; // Store the seed
        this._initializePermutationTable();
    }

    _initializePermutationTable() {
        // Use a local, seedable pseudo-random number generator (PRNG)
        let currentSeed = this.seed;
        const random = () => {
            // Simple linear congruential generator (LCG)
            // Parameters from POSIX.1-2001, glibc (used in Visual C++), Numerical Recipes
            const a = 1103515245;
            const c = 12345;
            const m = Math.pow(2, 31) -1; // A large prime (Mersenne prime M31)
            currentSeed = (a * currentSeed + c) % m;
            return currentSeed / m; // Normalize to [0, 1)
        };

        const pTable = new Uint8Array(256);
        for (let i = 0; i < 256; i++) {
            pTable[i] = i;
        }

        // Fisher-Yates Shuffle using the seeded PRNG
        for (let i = 255; i > 0; i--) {
            const j = Math.floor(random() * (i + 1));
            [pTable[i], pTable[j]] = [pTable[j], pTable[i]];
        }

        for (let i = 0; i < 256; i++) {
            this.p[i] = this.p[i + 256] = pTable[i];
        }
    }

    _fade(t) {
        return t * t * t * (t * (t * 6 - 15) + 10); // 6t^5 - 15t^4 + 10t^3
    }

    _grad3D(hash, x, y, z) {
        const h = hash & 15;        // Convert low 4 bits of hash code into 12 gradient directions
        const u = h < 8 ? x : y;
        const v = h < 4 ? y : (h === 12 || h === 14 ? x : z);
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }

    noise3D(x, y, z) {
        let X = Math.floor(x) & 255; // Integer part of x, clamped to 0-255
        let Y = Math.floor(y) & 255; // Integer part of y
        let Z = Math.floor(z) & 255; // Integer part of z

        x -= Math.floor(x);          // Fractional part of x
        y -= Math.floor(y);          // Fractional part of y
        z -= Math.floor(z);          // Fractional part of z

        const u = this._fade(x);     // Smoothly interpolated fractional part of x
        const v = this._fade(y);     // Smoothly interpolated fractional part of y
        const w = this._fade(z);     // Smoothly interpolated fractional part of z

        const A = this.p[X] + Y;
        const AA = this.p[A] + Z;
        const AB = this.p[A + 1] + Z;
        const B = this.p[X + 1] + Y;
        const BA = this.p[B] + Z;
        const BB = this.p[B + 1] + Z;

        // Use standalone lerp for all interpolations
        return lerp(w,
            lerp(v,
                lerp(u, this._grad3D(this.p[AA], x, y, z), this._grad3D(this.p[BA], x - 1, y, z)),
                lerp(u, this._grad3D(this.p[AB], x, y - 1, z), this._grad3D(this.p[BB], x - 1, y - 1, z))
            ),
            lerp(v,
                lerp(u, this._grad3D(this.p[AA + 1], x, y, z - 1), this._grad3D(this.p[BA + 1], x - 1, y, z - 1)),
                lerp(u, this._grad3D(this.p[AB + 1], x, y - 1, z - 1), this._grad3D(this.p[BB + 1], x - 1, y - 1, z - 1))
            )
        );
    }
}

// Instantiate Perlin Noise with a fixed seed for repeatable terrain
const perlin = new PerlinNoise();

// Base multi-octave noise generation
function multiOctavePerlinNoise3D(x, y, z, octaves = 6, persistence = 0.5, lacunarity = 2.0) {
    let total = 0;
    let frequency = 1.0;
    let amplitude = 1.0;
    let maxValue = 0;  // Used to normalize the result to the range [-1, 1]

    for (let i = 0; i < octaves; i++) {
        total += perlin.noise3D(x * frequency, y * frequency, z * frequency) * amplitude;
        maxValue += amplitude;
        amplitude *= persistence;
        frequency *= lacunarity;
    }

    // Normalize to [-1, 1] then map to [0, 1]
    return (total / maxValue + 1) / 2;
}

// Generate noise for mountainous terrain
function generateMountainNoise(x, y, z) {
    return multiOctavePerlinNoise3D(x, y, z, 4, 0.6, 2.0);
}

// Generate noise for plains terrain
function generatePlainsNoise(x, y, z) {
    return multiOctavePerlinNoise3D(x, y, z, 4, 0.5, 2.0);
}

// Generate noise to act as a terrain type map (smooth transitions between plains and mountains)
function generateTerrainTypeNoise(x, y, z) {
    return multiOctavePerlinNoise3D(x * 0.1, y * 0.1, z * 0.1, 3, 0.4, 2.0);
}

// Generate noise for river potential (using absolute value to create ridges/valleys)
function generateRiverMaskNoise(x, y, z) {
    const noiseVal = multiOctavePerlinNoise3D(x * 0.5, y * 0.5, z * 0.5, 6, 0.5, 2.0);
    // Map noise from [0,1] to [-1,1] then take absolute value. Results in values near 0 being potential rivers.
    return Math.abs(noiseVal * 2 - 1);
}


// Main function to combine different terrain types and rivers
export function generateCombinedTerrain(x, y, z, mountain_threshold = 0.6, river_threshold = 0.1, river_depth = 0.15) {
    const terrainType = generateTerrainTypeNoise(x, y, z); // Value from 0 to 1

    const plainsNoiseVal = generatePlainsNoise(x, y, z);
    const mountainNoiseVal = generateMountainNoise(x, y, z);
    let terrainHeight;

    // Blend between plains and mountains based on terrainType
    if (terrainType < mountain_threshold) {
        // As terrainType goes from 0 to mountain_threshold, blend from plains to mountains
        const blendFactor = terrainType / mountain_threshold; // 0 to 1
        terrainHeight = lerp(blendFactor, plainsNoiseVal, mountainNoiseVal);
    } else {
        // Above or at the threshold, it's primarily mountain terrain.
        // This ensures continuity as the previous block approaches mountainNoiseVal at the threshold.
        terrainHeight = mountainNoiseVal;
    }

    // Generate river mask value (0 to 1, where lower values are potential river areas)
    const riverMask = generateRiverMaskNoise(x, y, z);

    // Apply river carving
    if (riverMask < river_threshold) {
        const riverInfluence = 1.0 - (riverMask / river_threshold);
        terrainHeight -= riverInfluence * river_depth; // Reduce height to carve river
        terrainHeight = Math.max(terrainHeight, 0);
    }

    return Math.max(0, Math.min(1, terrainHeight)); // Final clamp to [0, 1]
}