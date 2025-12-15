// --- Main application orchestrator for Three.js and Cannon.js ---

// Access globally loaded libraries exposed by script tags
const { 
    Group, Scene, PerspectiveCamera, WebGLRenderer, Clock, 
    DirectionalLight, AmbientLight, Color, Vector3, Euler,
} = window.THREE;

const { 
    World, Vec3, Body,
} = window.CANNON;

import { initializeScene } from './SceneInitializer.js';
import { setupActions } from './SceneActions.js';
import { 
    fixedTimeStep, maxSubSteps, playerRadius, MOVEMENT_SPEED,
    _cameraDirection
} from '../constants.js'; 
import { PENTOMINO_ASSETS, PENTOMINO_KEYS } from '../data/Pentominos.js';

export class SceneManager {
    constructor(container) {
        this.container = container;
        
        // THREE.js Core
        this.scene = new Scene();
        this.clock = new Clock();
        this.renderer = null;
        this.camera = null;
        this.cameraParent = null; // Group for horizontal rotation/position

        // Physics Core (Cannon.js)
        this.world = null;
        this.playerBody = null;
        this.isGrounded = true;
        
        // Game State & Objects
        this.controls = null;
        this.placementTool = null;
        this.placedMeshes = {}; 
        this.placedBodies = {}; 
        
        // Dynamic Objects (Pushable boxes)
        this.dynamicMeshes = []; 
        this.dynamicBodies = []; 

        // Asset/Color Selection
        this.assetIndex = 0;

        // === NEW: Pentomino Drop State ===
        this.lastDropTime = 0;
        this.dropInterval = 2.0; // Drop every 2 seconds
        this.dropZoneSize = 45; // Pentominoes drop within a 100x100 area
        this.dropHeight = 50;    // Pentominoes start 50 units above ground
        
        // --- Action Binding Delegation ---
        setupActions(this);
        
        // --- Initialization Delegation ---
        initializeScene(this);
        
        // === DEBUGGING CHECK 1: Core Setup ===
        if (this.renderer && this.renderer.domElement) {
            console.log("✅ Renderer setup successful. DOM element:", this.renderer.domElement);
            const canvas = this.renderer.domElement;
            console.log(`Canvas ID: ${canvas.id || 'N/A'}, Size: ${canvas.width}x${canvas.height}`);
            if (canvas.width === 0 || canvas.height === 0) {
                 console.warn("⚠️ Canvas initialized but has zero width/height. Check CSS and window resize listener.");
            }
        } else {
            console.error("❌ Renderer setup failed. this.renderer is null or missing domElement.");
        }
        
        if (this.scene.children.length > 2) { 
            console.log(`✅ Scene populated with ${this.scene.children.length} objects (should include cameraParent, lights, and objects).`);
        } else {
            console.warn("⚠️ Scene seems sparsely populated. Check if objects (floor, boxes) were added correctly in SceneInitializer.");
        }
        
        // Used for logging player position every half second
        this._lastLogTime = 0; 
    }

    // --- MAIN LOOP ---

    animate() {
        if (!this._animationStarted) {
            console.log("▶️ Animation loop started successfully.");
            this._animationStarted = true;
        }
        
        // 1. Check for core components before rendering/updating
        if (!this.renderer || !this.scene || !this.camera || !this.world) {
            console.error("❌ Cannot animate: Core component(s) are missing (renderer, scene, camera, or world). Stopping loop.");
            return;
        }

        requestAnimationFrame(this.animate.bind(this));

        const delta = this.clock.getDelta();
        const elapsed = this.clock.getElapsedTime();

        if (this._fadeState && this._fadeState.active) {
            const { startTime, peakTime, maxOpacity, overlayMesh, onComplete } = this._fadeState;
            
            // --- Calculation for fade IN (only) ---
            let progress = (elapsed - startTime) / (peakTime - startTime);
            
            if (progress >= 1.0) {
                // End of fade: Set final opacity and deactivate
                overlayMesh.material.opacity = maxOpacity;
                this._fadeState.active = false;
                onComplete();
                
                // NOTE: If you want it to fade *back out* automatically, 
                // the fade logic needs to be extended to a two-phase process (in and out).
            } else {
                // Interpolate the opacity: Goes from 0.0 to maxOpacity
                overlayMesh.material.opacity = maxOpacity * progress;
            }
        }

        // === NEW: Pentomino Drop Logic ===
        if (document.hasFocus() && elapsed > this.lastDropTime + this.dropInterval) {
            this.dropRandomPentomino();
            this.lastDropTime = elapsed;
        }
        
        // 1. Update Cannon.js Physics World
        this.world.step(fixedTimeStep, delta, maxSubSteps);
        // ====================================================

        // 2. Update Player Movement Physics
        
        // Calculate the world direction of the camera parent (horizontal look direction)
        _cameraDirection.set(0, 0, -1).applyEuler(this.cameraParent.rotation);
        _cameraDirection.y = 0; 
        _cameraDirection.normalize(); 

        const rightVector = new Vector3();
        // Calculate vector perpendicular to camera direction (strafe direction)
        rightVector.crossVectors(new Vector3(0, 1, 0), _cameraDirection); 
        rightVector.normalize();

        // CRITICAL FIX: Removed the unstable (1/delta) multiplier.
        // MOVEMENT_SPEED is now treated as the target instantaneous speed (m/s).
        const baseMoveSpeed = MOVEMENT_SPEED; 
        const inputVelocityTHREE = new Vector3(0, 0, 0); // THREE.js Vector3 for clean calculations

        if (this.controls.moveForward) inputVelocityTHREE.addScaledVector(_cameraDirection, baseMoveSpeed);
        if (this.controls.moveBackward) inputVelocityTHREE.addScaledVector(_cameraDirection, -baseMoveSpeed);
        if (this.controls.moveLeft) inputVelocityTHREE.addScaledVector(rightVector, baseMoveSpeed);
        if (this.controls.moveRight) inputVelocityTHREE.addScaledVector(rightVector, -baseMoveSpeed);

        // Apply input velocity to the player body's current velocity (overriding x and z)
        // This is safe because inputVelocityTHREE is now using the correct units (m/s).
        this.playerBody.velocity.x = inputVelocityTHREE.x;
        this.playerBody.velocity.z = inputVelocityTHREE.z;

        // 4. Synchronize Three.js Meshes with Cannon.js Bodies
        
        // Update Camera Parent position to match player physics body
        this.cameraParent.position.copy(this.playerBody.position); 
        
        // Synchronize Dynamic (pushable/dropping) Boxes
        for (let i = 0; i < this.dynamicMeshes.length; i++) {
            const mesh = this.dynamicMeshes[i];
            const body = this.dynamicBodies[i];
            
            // Check if body is in the world before copying position
            if (body.world) {
                mesh.position.copy(body.position);
                mesh.quaternion.copy(body.quaternion);
            }
        }

        // 6. Render
        this.renderer.render(this.scene, this.camera);
    }

    /**
     * Creates and drops a single random Pentomino piece from the sky.
     */
    dropRandomPentomino() {
        // 1. Select a random Pentomino asset
        const randomIndex = Math.floor(Math.random() * PENTOMINO_ASSETS.length);
        const asset = PENTOMINO_ASSETS[randomIndex];
        
        // 2. Determine random position (X, Z) and height (Y)
        const x = (Math.random() * this.dropZoneSize) - (this.dropZoneSize / 2); // -50 to 50
        const z = (Math.random() * this.dropZoneSize) - (this.dropZoneSize / 2); // -50 to 50
        const y = this.dropHeight;
        
        const initialPosition = new Vector3(x, y, z);

        // 3. Determine completely random rotation (X, Y, Z) for complex orientations
        // The rotation range is 0 to 2*PI (0 to 360 degrees) for true randomness.        
        const rx = Math.random() * Math.PI * 2;
        const ry = Math.random() * Math.PI * 2;
        const rz = Math.random() * Math.PI * 2;
        const initialRotation = new Euler(rx, ry, rz); // Assuming Euler is imported
        
        // 4. Create THREE.js Mesh Group
        const pieceMesh = asset.createMesh(1); // 1 is the thickness
        pieceMesh.position.copy(initialPosition);
        pieceMesh.rotation.copy(initialRotation);
        this.scene.add(pieceMesh);

        // 5. Create CANNON.js Dynamic Body (Mass > 0 to fall)
        const pieceBody = asset.createBody(initialPosition, initialRotation);
        
        // Overwrite mass to make it dynamic (e.g., mass based on volume/density)
        // A mass of 5 units * 10 = 50 is a good starting point.
        pieceBody.mass = 50; 
        pieceBody.type = Body.DYNAMIC;
        this.world.addBody(pieceBody);
        
        // 6. Store the new dynamic pieces 
        this.dynamicMeshes.push(pieceMesh);
        this.dynamicBodies.push(pieceBody);
    }
}