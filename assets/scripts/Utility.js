// Utility.js
import * as THREE from 'three';

/// Function to generate a random color
export function getSimilarColour(color, variation = 0.2) {
    const baseColor = new THREE.Color(color);
    const hsl = {};
    baseColor.getHSL(hsl);

    const hueVariation = (Math.random() - 0.5) * variation;
    const saturationVariation = (Math.random() - 0.5) * variation;
    const lightnessVariation = (Math.random() - 0.5) * variation;

    let newHue = THREE.MathUtils.clamp(hsl.h + hueVariation, 0, 1);
    let newSaturation = THREE.MathUtils.clamp(hsl.s + saturationVariation, 0, 1);
    let newLightness = THREE.MathUtils.clamp(hsl.l + lightnessVariation, 0, 1);

    const newColor = new THREE.Color().setHSL(newHue, newSaturation, newLightness);
    return newColor.getHex();
}

export function lerpColor(color1, color2, t) {
  return color1.clone().lerp(color2, t);
}