// perlinNoise.js

class PerlinNoise {
    constructor(seed = Math.random()) {
        this.p = new Uint8Array(512);
        this.seed = seed;
        this._initializePermutationTable();
    }

    _initializePermutationTable() {
        let random = () => {
            var x = Math.sin(this.seed++) * 10000;
            return x - Math.floor(x);
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

const perlin = new PerlinNoise();

export function multiOctavePerlinNoise3D(x, y, z, octaves = 6, persistence = 0.5, lacunarity = 2.0) {
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