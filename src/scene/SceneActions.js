// Utility module for handling player actions, object placement, and data persistence.

const {
    Color, BoxGeometry, MeshBasicMaterial, Mesh, PlaneGeometry,
} = window.THREE;

const { 
    Body, Box, Vec3 
} = window.CANNON;

import { 
    JUMP_VELOCITY, blockColors, colorIndex 
} from '../constants.js';


// --- GAME ACTIONS ---

/**
 * Handles the player jump action.
 */
function handleJump() {
    if (!this.movementEnabled) return;

    if (this.isGrounded && this.playerBody) { 
        this.playerBody.velocity.y = JUMP_VELOCITY;
        this.isGrounded = false; 
    }
}

/**
 * Resets the player's position and game state to the starting conditions.
 */
function restartGame() {
    this.setMovementEnabled(false);

    if (this.playerBody) {
        this.playerBody.set(0, 10, 0);
        this.playerBody.velocity.set(0, 0, 0);
        this.playerBody.quaternion.set(0, 0, 0, 1);
    }

    if (this.cameraParent) {
        this.cameraParent.position.set(0, 10, 0);
    }

    if (this._fadeState && this._fadeState.overlayMesh) {
        this._fadeState.overlayMesh.material.opacity = 0.0;
        this._fadeState.active = false;
    }

    this.setMovementEnabled(true);
    console.log("Game restarted");
}

function setMovementEnabled(enabled) {
    this.movementEnabled = enabled;
    if (this.controls && typeof this.controls.setEnabled === 'function') {
        this.controls.setEnabled(enabled);
    }
    if (!enabled && this.playerBody) {
        this.playerBody.velocity.set(0, 0, 0);
    }
    console.log(`Movement ${enabled ? 'ENABLED' : 'DISABLED'}.`);
}

// --- UI & RESIZE ---

/**
 * Handles window resize events.
 */
function onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
}

function setupKeyboardRestartListener(manager) {
    document.addEventListener('keydown', (event) => {
        if (event.code === 'KeyR') {
            event.preventDefault();

            if (!manager.movementEnabled) {
                manager.restartGame();
            } else {

            }
        }
    });
    console.log("Restart listener activated");
}

/**
 * Binds all action and persistence methods to the SceneManager instance.
 * @param {SceneManager} manager - The instance of the SceneManager class.
 */
export function setupActions(manager) {
    // Bind public methods to the instance to ensure `this` works correctly
    manager.movementEnabled = true;
    manager.handleJump = handleJump.bind(manager);
    manager.setMovementEnabled = setMovementEnabled.bind(manager);
    manager.restartGame = restartGame.bind(manager);

    manager.onWindowResize = onWindowResize.bind(manager);
    manager.fadeScreenToRed = fadeScreenToRed.bind(manager);

    setupKeyboardRestartListener(manager);
}

/**
 * Creates or retrieves the fullscreen red overlay mesh.
 * This mesh is attached directly to the camera to cover the entire view.
 * @param {SceneManager} manager
 */
function getOrCreateOverlayMesh(manager) {
    if (manager._redOverlayMesh) {
        return manager._redOverlayMesh;
    }

    // 1. Create a large plane geometry
    // This plane needs to be placed very close to the camera, filling the FOV.
    const geometry = new PlaneGeometry(20, 20); // Large enough to fill the view
    const material = new MeshBasicMaterial({
        color: 0xFF0000, // Starting color: Red
        transparent: true,
        opacity: 0.0, // Start fully transparent
        depthTest: false, // Ensure it draws over other objects
        depthWrite: false,
    });

    const mesh = new Mesh(geometry, material);
    
    // Position it very close to the camera, just beyond the near clipping plane (e.g., z=-0.1)
    mesh.position.set(0, 0, -0.1); 
    
    // Attach it directly to the camera so it follows all camera movement/rotation
    manager.camera.add(mesh);

    manager._redOverlayMesh = mesh;
    return mesh;
}

/**
 * Smoothly fades the entire screen view to a target color (e.g., red)
 * by manipulating the opacity of a fullscreen overlay mesh.
 * * @param {Color} targetColor - The final color to fade to (e.g., 0xFF0000 for red).
 * @param {number} maxOpacity - The peak opacity (e.g., 0.8 for a semi-transparent red).
 * @param {number} duration - The time in seconds for the fade (e.g., 0.5s).
 * @param {function} [onComplete] - Callback function when the fade is done.
 */
function fadeScreenToRed(targetColor = new Color(0xFF0000), maxOpacity = 0.8, duration = 0.3, onComplete = () => {}) {
    const overlayMesh = getOrCreateOverlayMesh(this);
    
    this.setMovementEnabled(false);
    // Ensure the color is set if it changes
    overlayMesh.material.color.copy(targetColor);

    const startTime = this.clock.getElapsedTime();
    const peakTime = startTime + duration; // Time to reach max opacity
    
    // Set up the state for the animation loop
    this._fadeState = {
        active: true,
        startTime: startTime,
        peakTime: peakTime,
        maxOpacity: maxOpacity,
        overlayMesh: overlayMesh,
        onComplete: () => {
            onComplete();
        },
    };
    
    console.log("Fading to red overlay...");
}