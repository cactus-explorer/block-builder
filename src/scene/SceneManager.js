// --- Main application orchestrator for Three.js and Cannon.js ---

// Access globally loaded libraries exposed by script tags
const { 
    Group, Scene, PerspectiveCamera, WebGLRenderer, Clock, 
    DirectionalLight, AmbientLight, Color, Vector3,
} = window.THREE;

const { 
    World, Vec3, 
} = window.CANNON;

import { initializeScene } from './SceneInitializer.js';
import { setupActions } from './SceneActions.js';
import { DECORATION_ASSET_KEYS } from '../data/AssetCatalog.js'; 
import { 
    fixedTimeStep, maxSubSteps, playerRadius, MOVEMENT_SPEED,
    _cameraDirection
} from '../constants.js'; 

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
        
        this.updateAssetSelectionUI();
    }

    // --- MAIN LOOP ---

    animate() {
        // === DEBUGGING CHECK 2: Loop Execution ===
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
        
        // 1. Update Cannon.js Physics World
        this.world.step(fixedTimeStep, delta, maxSubSteps);

        // 2. Update Player Movement Physics
        
        // Calculate the world direction of the camera parent (horizontal look direction)
        _cameraDirection.set(0, 0, -1).applyEuler(this.cameraParent.rotation);
        _cameraDirection.y = 0; 
        _cameraDirection.normalize(); 

        const rightVector = new Vector3();
        // Calculate vector perpendicular to camera direction (strafe direction)
        rightVector.crossVectors(new Vector3(0, 1, 0), _cameraDirection); 
        rightVector.normalize();

        const moveSpeed = MOVEMENT_SPEED * delta;
        const inputVelocity = new Vector3(0, 0, 0);

        if (this.controls.moveForward) inputVelocity.addScaledVector(_cameraDirection, moveSpeed);
        if (this.controls.moveBackward) inputVelocity.addScaledVector(_cameraDirection, -moveSpeed);
        if (this.controls.moveLeft) inputVelocity.addScaledVector(rightVector, moveSpeed);
        if (this.controls.moveRight) inputVelocity.addScaledVector(rightVector, -moveSpeed);

        // Apply input velocity to the player body's current velocity (overriding x and z)
        this.playerBody.velocity.x = inputVelocity.x * (1/delta);
        this.playerBody.velocity.z = inputVelocity.z * (1/delta);
        
        // 4. Synchronize Three.js Meshes with Cannon.js Bodies
        
        // Update Camera Parent position to match player physics body
        this.cameraParent.position.copy(this.playerBody.position); 
        
        // Synchronize Dynamic (pushable) Boxes
        for (let i = 0; i < this.dynamicMeshes.length; i++) {
            const mesh = this.dynamicMeshes[i];
            const body = this.dynamicBodies[i];
            
            mesh.position.copy(body.position);
            mesh.quaternion.copy(body.quaternion);
        }

        // 5. Update Placement Tool
        const currentAssetKey = DECORATION_ASSET_KEYS[this.assetIndex];
        this.placementTool.updateGhostPosition(currentAssetKey);


        // 6. Render
        this.renderer.render(this.scene, this.camera);
        
        // === DEBUGGING CHECK 3: Frame Rate / Jitter Check ===
        // Uncomment this block if the scene renders but appears to be flickering or slow.
        /*
        const fps = 1 / delta;
        if (fps < 30) {
             console.warn(`⚠️ Low FPS: ${fps.toFixed(1)} fps. Performance issue detected.`);
        }
        */
    }
}