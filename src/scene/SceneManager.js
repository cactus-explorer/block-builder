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
        this.placedMeshes = {}; // Map of object IDs to THREE.Mesh instances (Static/User-Placed)
        this.placedBodies = {}; // Map of object IDs to CANNON.Body instances (Static/User-Placed)
        
        // Dynamic Objects (Pushable boxes)
        this.dynamicMeshes = []; 
        this.dynamicBodies = []; 

        // Asset/Color Selection
        this.assetIndex = 0;
        
        // --- Action Binding Delegation ---
        // MUST RUN FIRST: This defines methods like manager.onWindowResize
        setupActions(this);
        
        // --- Initialization Delegation ---
        // Can now safely access bound methods
        initializeScene(this);
        
        
        // Initial UI state setup is handled in SceneActions/setupDataListeners
        this.updateAssetSelectionUI();
    }

    // --- MAIN LOOP ---

    animate() {
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
    }
}