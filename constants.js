export const fixedTimeStep = 1 / 60; // seconds
export const maxSubSteps = 3;
export const playerRadius = 1.5;
export const jumpVelocity = 15; // INCREASED to 15
export const blockColors = [0xFF0000, 0x00FF00, 0x0000FF, 0xFFFF00, 0xFF00FF, 0x00FFFF, 0xFFFFFF];
export let colorIndex = 0;

// Reusable THREE.js/CANNON.js objects to avoid allocation in main loop
export const _cameraDirection = new window.THREE.Vector3();
export const _rayStart = new window.CANNON.Vec3();
export const _rayEnd = new window.CANNON.Vec3();
export const _rayResult = new window.CANNON.RaycastResult();

export const _lookDirection = new window.THREE.Vector3();
export const _spherical = new window.THREE.Spherical();
export const _targetPosition = new window.THREE.Vector3();


export function cycleColorIndex(direction) {
    colorIndex = (colorIndex + direction + blockColors.length) % blockColors.length;
}