// perlinNoise.js

// Standalone lerp function
function lerp(t, a, b) {
    return a + t * (b - a);
}

class PerlinNoise {
    constructor(seed = 0) { // Default seed to 0 for consistent terrain, or allow it to be set
        this.p = new Uint8Array(512); // Increased permutation table size for larger integer coordinates before repeating pattern
        this.seed = seed === 0 ? Date.now() : seed;
        this._initializePermutationTable();
    }

    _initializePermutationTable() {
        let currentSeed = this.seed;
        const random = () => {
            const a = 1103515245;
            const c = 12345;
            const m = Math.pow(2, 31) -1;
            currentSeed = (a * currentSeed + c) % m;
            return currentSeed / m;
        };

        const pTable = new Uint8Array(256);
        for (let i = 0; i < 256; i++) {
            pTable[i] = i;
        }

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

    _grad3D(hash, x, y, z) {
        const h = hash & 15;
        const u = h < 8 ? x : y;
        const v = h < 4 ? y : (h === 12 || h === 14 ? x : z);
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }

    noise3D(x, y, z) {
        // Ensure positive coordinates for modulo arithmetic if necessary, though floor handles negatives.
        // The & 255 operation will handle wrapping for the permutation table lookup.
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

// Instantiate Perlin Noise
const perlin = new PerlinNoise(Date.now() % 1000);

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
    return (total / maxValue + 1) / 2;
}

function generateMountainNoise(x, y, z) {
    return multiOctavePerlinNoise3D(x, y, z, 8, 0.6, 2.0);
}

function generatePlainsNoise(x, y, z) {
    return multiOctavePerlinNoise3D(x, y, z, 4, 0.3, 2.0);
}

function generateTerrainTypeNoise(x, y, z) {
    return multiOctavePerlinNoise3D(x * 0.1, y * 0.1, z * 0.1, 3, 0.4, 2.0); // Slower changing noise for broader areas
}

function generateRiverMaskNoise(x, y, z) {
    const noiseVal = multiOctavePerlinNoise3D(x * 0.5, y * 0.5, z * 0.5, 6, 0.5, 2.0);
    return Math.abs(noiseVal * 2 - 1);
}
// Helper for smoothstep, if not already available
function smoothstep(edge0, edge1, x) {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
}

export function generateCombinedTerrain(x, y, z,
    mountain_threshold = 0.6, // This might now represent a midpoint or upper bound of a blend zone
    mountain_blend_range = 0.2, // How wide the transition zone is
    river_threshold = 0.1,
    river_blend_range = 0.05, // Transition zone for rivers
    river_depth = 0.15) {

    const terrainType = generateTerrainTypeNoise(x, y, z);
    const plainsNoiseVal = generatePlainsNoise(x, y, z);
    const mountainNoiseVal = generateMountainNoise(x, y, z);
    let terrainHeight;

    // Smoothly blend between plains and mountains
    // Determine the start and end of the transition zone for mountains
    const mountain_lower_bound = mountain_threshold - mountain_blend_range / 2;
    const mountain_upper_bound = mountain_threshold + mountain_blend_range / 2;

    // Calculate mountain influence (0 for pure plains, 1 for pure mountain)
    let mountainInfluence;
    if (mountain_blend_range <= 0) { // Handle no blend range (hard switch)
        mountainInfluence = (terrainType >= mountain_threshold) ? 1.0 : 0.0;
    } else {
        // Using smoothstep for a smoother transition
        mountainInfluence = smoothstep(mountain_lower_bound, mountain_upper_bound, terrainType);
        // Alternatively, for a linear transition:
        // const t = (terrainType - mountain_lower_bound) / mountain_blend_range;
        // mountainInfluence = Math.max(0, Math.min(1, t));
    }
    terrainHeight = lerp(mountainInfluence, plainsNoiseVal, mountainNoiseVal);

    const riverMask = generateRiverMaskNoise(x, y, z);
    // Smoothly apply river depth
    const river_lower_bound = river_threshold - river_blend_range / 2;
    const river_upper_bound = river_threshold + river_blend_range / 2;

    let riverFactor;
    if (river_blend_range <= 0) {
        riverFactor = (riverMask < river_threshold) ? 1.0 : 0.0;
    } else {
        // riverFactor will be 1 deep inside the river criteria, 0 outside, smooth transition
        // We want riverFactor to be 1 when riverMask is low, and 0 when riverMask is high.
        // So, we invert the smoothstep logic or use 1.0 - smoothstep(...)
        const t_river = (riverMask - river_lower_bound) / river_blend_range;
        riverFactor = 1.0 - Math.max(0, Math.min(1, t_river)); // Linear, inverted
        // For smoothstep: riverFactor = 1.0 - smoothstep(river_lower_bound, river_upper_bound, riverMask);
    }

    if (riverFactor > 0) {
        terrainHeight -= riverFactor * river_depth;
    }

    // Ensure final height is clamped to the normalized range [0,1]
    return Math.max(0, Math.min(1, terrainHeight));
}