// --- Handles Mouse Pointer Lock, Keyboard Input, and Game Actions ---
import { MOVEMENT_SPEED } from './constants.js';

export class FirstPersonControls {
    /**
     * @param {THREE.Camera} camera - The camera mesh (for pitch).
     * @param {THREE.Group} cameraParent - The parent group (for yaw and position).
     * @param {HTMLElement} domElement - The DOM element to attach events to.
     */
    constructor(camera, cameraParent, domElement, manager) {
        this.camera = camera;
        this.cameraParent = cameraParent; // New property: the group being rotated horizontally
        this.domElement = domElement;
        this.manager = manager;
        
        // Movement State
        this.movementSpeed = MOVEMENT_SPEED;
        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;

        this.controlsEnabled = true;

        // Action Callbacks
        this.onJump = () => {};
        this.onPlaceObject = () => {};
        this.onRotateObject = () => {};
        this.onColorChange = () => {}; // Used for Q/E keys
        this.onFadeScreen = () => {}; // <--- NEW: Fade screen action

        // Mouse sensitivity (rotation speed)
        this.mouseSensitivity = 0.002;
        this.isLocked = false;

        // Event handler bindings
        this._onPointerLockChange = this._onPointerLockChange.bind(this);
        this._onPointerLockError = this._onPointerLockError.bind(this);
        this._onMouseMove = this._onMouseMove.bind(this);
        this._onKeyDown = this._onKeyDown.bind(this);
        this._onKeyUp = this._onKeyUp.bind(this);
        this._onPointerDown = this._onPointerDown.bind(this); 
        this._onPointerUp = this._onPointerUp.bind(this); 
        this._onVisibilityChange = this._onVisibilityChange.bind(this);
        
        this._setupEventListeners();
    }

    /**
     * Public method to enable/disable controls.
     * @param {boolean} enabled
     */
    setControlsEnabled(enabled) {
        this.controlsEnabled = enabled;
        if (!enabled) {
            this.unlock();
            this.clearMovementState();
        }
    }

    /**
     * Clears all movement flags.
     */
    clearMovementState() {
        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;
    }

    _setupEventListeners() {
        document.addEventListener('pointerlockchange', this._onPointerLockChange, false);
        document.addEventListener('pointerlockerror', this._onPointerLockError, false);
        
        document.addEventListener('mousemove', this._onMouseMove, false);
        document.addEventListener('keydown', this._onKeyDown, false);
        document.addEventListener('keyup', this._onKeyUp, false);
        
        // Mouse click for actions
        document.addEventListener('mousedown', this._onPointerDown, false);
        document.addEventListener('mouseup', this._onPointerUp, false);
        
        // Listener for the start button
        const startButton = document.getElementById('startButton');
        if (startButton) {
            startButton.addEventListener('click', this.lock.bind(this), false);
        }
        
        // Unlock if the window loses focus
        document.addEventListener('visibilitychange', this._onVisibilityChange);
    }

    // --- Utility and State Handlers ---

    _onVisibilityChange() {
        if (document.hidden) {
            this.unlock();
        }
    }

    _onPointerLockChange() {
        if (document.pointerLockElement === this.domElement) {
            this.isLocked = true;
            console.log("Pointer lock acquired.");
        } else {
            this.isLocked = false;
            console.log("Pointer lock released.");
        }
    }

    _onPointerLockError() {
        console.error("Pointer lock error.");
    }

    lock() {
        this.domElement.requestPointerLock();
    }
    
    unlock() {
        document.exitPointerLock();
    }
    
    handleResize() {
        // Placeholder
    }

    // --- Mouse Input (Rotation) ---
    _onMouseMove(event) {
        if (this.isLocked === false) return;

        if (this.manager && !this.manager.movementEnabled) return;

        event.preventDefault(); 
        
        // 1. Yaw (Horizontal Rotation) - Applies to the PARENT Group's Y-axis (world yaw)
        this.cameraParent.rotation.y -= event.movementX * this.mouseSensitivity;

        // 2. Pitch (Vertical Rotation) - Applies to the CAMERA's local X-axis (local pitch)
        let pitch = this.camera.rotation.x - event.movementY * this.mouseSensitivity;
        
        // Clamp vertical rotation 
        pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch));
        this.camera.rotation.x = pitch;
    }
    
    // --- Mouse Input (Actions) ---
    _onPointerDown(event) {
        if (this.isLocked === false) return;
        if (this.manager && !this.manager.movementEnabled) return;

        event.preventDefault();
        
        switch (event.button) {
            case 0: // Left Click: Place Object
                this.onPlaceObject();
                break;
            case 2: // Right Click: Rotate Object
                this.onRotateObject();
                break;
        }
    }

    _onPointerUp(event) {
        // Placeholder
    }

    // --- Keyboard Input (Movement & Actions) ---
    _onKeyDown(event) {
        if (this.isLocked === false) return;

        if (this.manager && !this.manager.movementEnabled) return;

        switch (event.code) {
            case 'KeyW':
            case 'ArrowUp':
                this.moveForward = true;
                break;
            case 'KeyS':
            case 'ArrowDown':
                this.moveBackward = true;
                break;
            case 'KeyA':
            case 'ArrowLeft':
                this.moveLeft = true;
                break;
            case 'KeyD':
            case 'ArrowRight':
                this.moveRight = true;
                break;
            case 'Space':
                // Prevent scrolling when locked
                if (event.target === document.body) event.preventDefault(); 
                this.onJump();
                break;
            case 'KeyQ':
                this.onColorChange(-1); // Cycle backward
                break;
            case 'KeyE':
                this.onColorChange(1); // Cycle forward
                break;
            case 'KeyF': // <--- NEW: Trigger Fade
                this.onFadeScreen();
                break;
            case 'Escape':
                this.unlock();
                break;
        }
    }

    _onKeyUp(event) {
        if (this.isLocked === false) return;

        if (this.manager && !this.manager.movementEnabled) return;

        switch (event.code) {
            case 'KeyW':
            case 'ArrowUp':
                this.moveForward = false;
                break;
            case 'KeyS':
            case 'ArrowDown':
                this.moveBackward = false;
                break;
            case 'KeyA':
            case 'ArrowLeft':
                this.moveLeft = false;
                break;
            case 'KeyD':
            case 'ArrowRight':
                this.moveRight = false;
                break;
        }
    }

    // This update function is called by KinematicMovement
    update(delta) {
        if (this.manager && !this.manager.movementEnabled) {
            this.clearMovementState();
        }
        // Movement state is read here by KinematicMovement
    }
}