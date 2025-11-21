// --- Replaces the old physics-centric constants.js ---

// Access globally loaded libraries exposed by script tags
const { Vector3, MathUtils } = window.THREE; 
const { Vec3 } = window.CANNON; // Also grab Vec3 for consistency

// Player/Camera Configuration (Used by Physics)
export const fixedTimeStep = 1 / 60; // seconds for Cannon.js
export const maxSubSteps = 3;
export const playerRadius = 1.5; // Radius of player physics sphere
export const JUMP_VELOCITY = 15; 
export const MOVEMENT_SPEED = 25.0; // Horizontal movement acceleration factor

// Colors (Used by AssetCatalog and SceneManager for simple meshes)
export const blockColors = [
    0xf59e0b, // Amber
    0xef4444, // Red
    0x10b981, // Emerald
    0x3b82f6, // Blue
    0x8b5cf6, // Violet
];

// Current selection state
export let colorIndex = 0;
export const cycleColorIndex = (direction) => {
    colorIndex = (colorIndex + direction) % blockColors.length;
    if (colorIndex < 0) colorIndex += blockColors.length;
};

// THREE.js Helper Objects (Minimize object creation in main loop)
export const _lookDirection = new Vector3();
export const _spherical = {}; 
export const _targetPosition = new Vector3();
export const _cameraDirection = new Vector3();

// CANNON.js Helper Objects (For collision checks)
export const _cannonVec = new Vec3();