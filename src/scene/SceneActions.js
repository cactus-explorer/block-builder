// Utility module for handling player actions, object placement, and data persistence.

const {
    Color, BoxGeometry, MeshBasicMaterial, Mesh, PlaneGeometry,
} = window.THREE;

const { 
    Body, Box, Vec3 
} = window.CANNON;

import { dataService } from '../data/DataService.js';
import { ASSETS, DECORATION_ASSET_KEYS } from '../data/AssetCatalog.js';
import { 
    JUMP_VELOCITY, blockColors, colorIndex 
} from '../constants.js';


// --- GAME ACTIONS ---

/**
 * Handles the player jump action.
 */
function handleJump() {
    if (this.isGrounded && this.playerBody) { 
        this.playerBody.velocity.y = JUMP_VELOCITY;
        this.isGrounded = false; 
    }
}

/**
 * Places the ghost object into the scene as a permanent, static object.
 */
function placeObject() {
    if (!this.controls.isLocked) return;

    const assetKey = DECORATION_ASSET_KEYS[this.assetIndex];
    const asset = ASSETS[assetKey];
    if (!asset) return;

    const placementData = this.placementTool.getGhostData();
    const { position, rotation } = placementData;

    // 1. Create THREE.js Mesh (using generic Box for MVP)
    const [w, h, d] = asset.size || [1, 1, 1];
    const threeGeometry = new BoxGeometry(w, h, d);
    const threeMaterial = new MeshBasicMaterial({ 
        color: asset.color || blockColors[colorIndex], 
        wireframe: false 
    });
    const boxMesh = new Mesh(threeGeometry, threeMaterial);
    
    boxMesh.position.copy(position);
    boxMesh.rotation.copy(rotation);
    boxMesh.userData.assetId = asset.id;
    
    this.scene.add(boxMesh);
    
    // 2. Create CANNON.js Body (Static: mass: 0)
    const cannonShape = new Box(new Vec3(w / 2, h / 2, d / 2));
    const cannonBody = new Body({
        mass: 0, // Static
        shape: cannonShape,
        position: new Vec3(position.x, position.y, position.z)
    });
    cannonBody.quaternion.setFromEuler(rotation.x, rotation.y, rotation.z);
    
    this.world.add(cannonBody);
    manager.dynamicBodies.push(cannonBody);
    
    // Generate a temporary ID for the new object
    const newId = `obj_${Date.now()}_${Math.random().toFixed(4).substring(2)}`;
    this.placedMeshes[newId] = boxMesh;
    this.placedBodies[newId] = cannonBody;
    
    // Update raycasting targets
    this.placementTool.updatePlaceableSurfaces(Object.values(this.placedMeshes));
    
    // Immediately save the updated project state
    this.saveProject();
}

/**
 * Rotates the ghost object by 90 degrees.
 */
function rotateObject() {
    if (!this.controls.isLocked) return;
    this.placementTool.rotateGhost(Math.PI / 2); 
}

/**
 * Cycles to the next asset in the catalog.
 * @param {number} direction - 1 for forward, -1 for backward.
 */
function changeAsset(direction) {
    this.assetIndex = (this.assetIndex + direction) % DECORATION_ASSET_KEYS.length;
    if (this.assetIndex < 0) this.assetIndex += DECORATION_ASSET_KEYS.length;
    
    const assetKey = DECORATION_ASSET_KEYS[this.assetIndex];
    this.placementTool.updateGhostVisuals(assetKey);
    this.updateAssetSelectionUI();
}

// --- PERSISTENCE ---
    
/**
 * Serializes current scene state and saves it via the DataService.
 */
function saveProject() {
    const data = Object.keys(this.placedMeshes).map(id => {
        const mesh = this.placedMeshes[id];
        return {
            id: id,
            assetId: mesh.userData.assetId,
            position: mesh.position.toArray(),
            rotation: mesh.rotation.toArray().slice(0, 3) // x, y, z
        };
    });
    dataService.saveProject(data);
}

/**
 * Deletes the last placed object from the scene and updates storage.
 */
function deleteLastObject() {
    const lastId = Object.keys(this.placedMeshes).pop();
    if (lastId) {
        this.removeObject(lastId);
        this.saveProject();
    }
}

/**
 * Clears the current scene and loads data from the DataService.
 * @param {Array<Object>} projectData 
 */
function loadProject(projectData) {
    if (!Array.isArray(projectData)) {
        console.warn("Load failed: Project data is not a valid array.", projectData);
        Object.keys(this.placedMeshes).forEach(id => this.removeObject(id, true));
        return;
    }

    // 1. Clear existing objects (except permanent floor/lights/camera)
    Object.keys(this.placedMeshes).forEach(id => this.removeObject(id, true));

    // 2. Load new objects
    projectData.forEach(item => {
        if (!item || 
            !Array.isArray(item.position) || item.position.length < 3 || 
            !Array.isArray(item.rotation) || item.rotation.length < 3) {
            console.error("Skipping malformed or incomplete object data during load:", item);
            return;
        }

        const asset = Object.values(ASSETS).find(a => a.id === item.assetId);
        if (!asset) {
            console.warn(`Asset ID ${item.assetId} not found in catalog. Skipping object.`);
            return;
        }

        const [w, h, d] = asset.size || [1, 1, 1];
        
        // THREE.js Mesh
        const threeGeometry = new BoxGeometry(w, h, d);
        const threeMaterial = new MeshBasicMaterial({ 
            color: asset.color || 0xcccccc, 
            wireframe: false 
        });
        const boxMesh = new Mesh(threeGeometry, threeMaterial);
        boxMesh.position.fromArray(item.position);
        boxMesh.rotation.set(item.rotation[0], item.rotation[1], item.rotation[2]);
        boxMesh.userData.assetId = item.assetId;
        this.scene.add(boxMesh);
        
        // CANNON.js Body
        const cannonShape = new Box(new Vec3(w / 2, h / 2, d / 2));
        const cannonBody = new Body({
            mass: 0,
            shape: cannonShape,
            position: new Vec3().copy(item.position),
        });
        cannonBody.quaternion.setFromEuler(item.rotation[0], item.rotation[1], item.rotation[2]);
        this.world.addBody(cannonBody);
        
        this.placedMeshes[item.id] = boxMesh;
        this.placedBodies[item.id] = cannonBody;
    });
    
    console.log(`Project loaded. Total items: ${projectData.length}`);
    this.placementTool.updatePlaceableSurfaces(Object.values(this.placedMeshes));
}

/**
 * Removes a single object from the scene and physics world.
 */
function removeObject(id, skipSave = false) {
    const mesh = this.placedMeshes[id];
    const body = this.placedBodies[id];

    if (mesh) {
        this.scene.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
        delete this.placedMeshes[id];
    }

    if (body) {
        this.world.removeBody(body);
        delete this.placedBodies[id];
    }
    
    this.placementTool.updatePlaceableSurfaces(Object.values(this.placedMeshes));
    
    if (!skipSave) {
        this.saveProject();
    }
}


// --- UI & RESIZE ---

/**
 * Updates the asset selection UI based on the current assetIndex.
 */
function updateAssetSelectionUI() {
    const paletteContainer = document.getElementById('color-palette');
    if (!paletteContainer) return;
    
    // Re-generate swatches
    paletteContainer.innerHTML = '';
    DECORATION_ASSET_KEYS.forEach((key, index) => {
        const asset = ASSETS[key];
        const hexColor = asset.color || blockColors[index % blockColors.length];
        const colorObj = new Color(hexColor);
        const cssColor = '#' + colorObj.getHexString();

        const swatch = document.createElement('div');
        swatch.id = `asset-swatch-${index}`;
        swatch.className = 'w-8 h-8 rounded-full border-2 border-white/50 transition-all duration-150 cursor-pointer';
        swatch.style.backgroundColor = cssColor;
        
        if (index === this.assetIndex) {
             swatch.classList.add('ring-4', 'ring-offset-2', 'ring-yellow-400', 'ring-offset-gray-900/70', 'scale-110');
        } else {
             swatch.classList.add('scale-100');
        }
        
        // Click handler for direct selection
        swatch.addEventListener('click', () => {
            this.changeAsset(index - this.assetIndex); 
        });

        paletteContainer.appendChild(swatch);
    });
}

/**
 * Handles window resize events.
 */
function onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
}

/**
 * Binds all action and persistence methods to the SceneManager instance.
 * @param {SceneManager} manager - The instance of the SceneManager class.
 */
export function setupActions(manager) {
    // Bind public methods to the instance to ensure `this` works correctly
    manager.handleJump = handleJump.bind(manager);
    manager.placeObject = placeObject.bind(manager);
    manager.rotateObject = rotateObject.bind(manager);
    manager.changeAsset = changeAsset.bind(manager);

    manager.saveProject = saveProject.bind(manager);
    manager.deleteLastObject = deleteLastObject.bind(manager);
    manager.loadProject = loadProject.bind(manager);
    manager.removeObject = removeObject.bind(manager);
    
    manager.updateAssetSelectionUI = updateAssetSelectionUI.bind(manager);
    manager.onWindowResize = onWindowResize.bind(manager);
    manager.fadeScreenToRed = fadeScreenToRed.bind(manager);
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
        onComplete: onComplete,
    };
    
    console.log("Fading to red overlay...");
}