// Access globally loaded libraries
const { Vector3, MathUtils, Spherical, Color } = window.THREE;
const { Vec3, RaycastResult } = window.CANNON;

// --- Physics Constants ---
export const fixedTimeStep = 1 / 60; 
export const maxSubSteps = 3;
export const playerRadius = 2; 
export const jumpVelocity = 20; 

// --- Shared Utility Objects (for performance) ---
export const _lookDirection = new Vector3();
export const _spherical = new Spherical();
export const _targetPosition = new Vector3();
export const _cameraDirection = new Vector3();
export const _rayStart = new Vec3();
export const _rayEnd = new Vec3();
export const _rayResult = new RaycastResult();

// --- Game State Constants ---
export const blockColors = [
    0xffa500, // Orange
    0x3b82f6, // Blue
    0x8b5cf6, // Purple
    0xef4444, // Red
    0xf9fafb  // White
];
export let colorIndex = 0; 

/**
 * Updates the globally accessible color index.
 * @param {number} newIndex 
 */
export function setColorIndex(newIndex) {
    colorIndex = newIndex;
}

/**
 * Cycles the color index forward or backward.
 * @param {number} direction 1 for forward, -1 for backward.
 */
export function cycleColorIndex(direction) {
    const len = blockColors.length;
    let newIndex = colorIndex + direction;
    colorIndex = (newIndex % len + len) % len;
}