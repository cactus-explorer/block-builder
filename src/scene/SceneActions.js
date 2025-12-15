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
        this.playerBody.position.set(0, 2, 0);
        this.playerBody.velocity.set(0, 0, 0);
        this.playerBody.quaternion.set(0, 0, 0, 1);
    }

    if (this.cameraParent) {
        this.cameraParent.position.set(0, 2, 0);
    }

    if (this._fadeState && this._fadeState.overlayMesh) {
        this._fadeState.overlayMesh.material.opacity = 0.0;
        this._fadeState.active = false;
    }

    for (const mesh of this.dynamicMeshes) {
        this.scene.remove(mesh);
    }

    for (const body of this.dynamicBodies) {
        this.world.removeBody(body);
    }

    this.dynamicMeshes = [];
    this.dynamicBodies = [];

    console.log(`Removed ${this.dynamicMeshes.length} dynamic blocks.`);

    this.lastDropTime = 0;

    if (!this.metalBlockMaterial) {
        console.error("CRITICAL: this.metalBlockMaterial is undefined. Blocks will be invisible or fail to load. Check SceneInitializer.js -> initThree.");
    }

    for (let i = 0; i < 20; i++) {
        const size = Math.random() * 2 + 1; // Size between 1 and 3 meters
        const threeBoxGeometry = new BoxGeometry( size, size, size );
        // Use 'this' for the material
        const randomColorHex = blockColors[Math.floor(Math.random() * blockColors.length)];
        const threeBoxMaterial = new MeshBasicMaterial({
            color: new Color(randomColorHex)
        });

        const boxMesh = new Mesh( threeBoxGeometry, threeBoxMaterial );

        const x = Math.random() * 50 - 25; // Random x between -75 and 75
        const z = Math.random() * 50 - 25; // Random z between -75 and 75
        const y = size / 2 + 0.1; // Ensure it starts slightly above ground

        boxMesh.position.set(x, y, z);
        this.scene.add( boxMesh );
        this.dynamicMeshes.push(boxMesh);

        const cannonBoxShape = new Box(new Vec3(size/2, size/2, size/2));
        const cannonBoxBody = new Body({
            mass: size * 10, 
            shape: cannonBoxShape,
            position: new Vec3(x, y, z)
        });
        this.world.addBody(cannonBoxBody);
        this.dynamicBodies.push(cannonBoxBody);
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

            manager.restartGame();
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
1
    manager.updateScore = updateScore.bind(manager);
    manager.updateAssetSelectionUI = updateAssetSelectionUI.bind(manager);

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

/**
 * Updates the score property and the displayed score element.
 * @param {number} points - The amount to add to the current score.
 */
function updateScore(points) {
    this.score += points;
    if (this.scoreElement) {
        this.scoreElement.textContent = `SCORE: ${this.score}`;
    }
}

/**
 * Updates the asset selection UI based on the current assetIndex.
 * * NOTE: This function assumes the existence of the following properties 
 * on the 'this' (SceneManager) instance:
 * - this.assetIndex (number): The index of the currently selected asset.
 * - this.changeAsset (function): The bound function to change the asset.
 * - DECORATION_ASSET_KEYS (array): The list of keys for assets.
 * - ASSETS (object): The asset catalog containing asset definitions.
 */
function updateAssetSelectionUI() {
    // 1. Get the container element for the palette
    const paletteContainer = document.getElementById('color-palette');
    if (!paletteContainer) {
        console.warn("UI element 'color-palette' not found. Skipping UI update.");
        return;
    }

    // 2. Clear existing swatches
    paletteContainer.innerHTML = '';
    
    // Check if the required asset data is available (assuming you load it similarly to Pentominoes)
    if (!DECORATION_ASSET_KEYS || !ASSETS) {
        console.error("Asset keys or catalog are undefined.");
        return;
    }

    // 3. Generate new swatches for all available assets
    DECORATION_ASSET_KEYS.forEach((key, index) => {
        const asset = ASSETS[key];
        
        // Use the asset's specific color, or a fallback color if not defined
        const hexColor = asset.color || 0xcccccc; 
        
        // Convert hex number to CSS string (e.g., #RRGGBB)
        const colorObj = new window.THREE.Color(hexColor);
        const cssColor = '#' + colorObj.getHexString();

        const swatch = document.createElement('div');
        swatch.id = `asset-swatch-${index}`;
        
        // Apply base CSS classes (assuming Tailwind/modern CSS for styling)
        swatch.className = 'w-8 h-8 rounded-full border-2 border-white/50 transition-all duration-150 cursor-pointer';
        swatch.style.backgroundColor = cssColor;
        
        // 4. Highlight the currently selected asset
        if (index === this.assetIndex) {
             // Add highlighting classes for the currently selected item
             swatch.classList.add('ring-4', 'ring-offset-2', 'ring-yellow-400', 'ring-offset-gray-900/70', 'scale-110');
        } else {
             // Ensure non-selected items are not highlighted
             swatch.classList.add('scale-100');
        }
        
        // 5. Add click handler for direct selection
        swatch.addEventListener('click', () => {
            // Calculate the directional step needed to select this index
            const direction = index - this.assetIndex; 
            this.changeAsset(direction); 
        });

        paletteContainer.appendChild(swatch);
    });
}