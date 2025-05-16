// perlinnoise.js
export function perlin(x, y, z) {
  return Math.sin(x * 0.1) * Math.cos(y * 0.1) * Math.sin(z * 0.1);  // Simple multi-Perlin noise
}