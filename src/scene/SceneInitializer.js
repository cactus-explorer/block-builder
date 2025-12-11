// Utility module for setting up the initial 3D scene, physics world, and controls.

const { 
    Group, Scene, PerspectiveCamera, WebGLRenderer, Clock, 
    DirectionalLight, AmbientLight, Color, 
    BoxGeometry, MeshBasicMaterial, Mesh, PlaneGeometry
} = window.THREE;

const { 
    World, Body, Sphere, Plane, Box, Vec3 
} = window.CANNON;

import { FirstPersonControls } from '../controls.js';
import { PlacementTool } from './PlacementTool.js';
import { dataService } from '../data/DataService.js';
import { ASSETS, DECORATION_ASSET_KEYS } from '../data/AssetCatalog.js';
import { 
    playerRadius, blockColors, 
} from '../constants.js';

// --- Initialization Helpers ---

function initThree(manager) {
    // *** MODIFIED TO LOOK FOR PRE-EXISTING CANVAS ***
    
    // 1. Find the pre-existing canvas element by ID
    const canvasElement = document.getElementById('gameCanvas'); 
    
    // Renderer
    if (!canvasElement) {
        console.error("Canvas element with ID 'gameCanvas' not found. Creating a new one.");
        manager.renderer = new WebGLRenderer({ antialias: true });
        manager.container.appendChild(manager.renderer.domElement); 
    } else {
        // Use the existing canvas element
        manager.renderer = new WebGLRenderer({ antialias: true, canvas: canvasElement });
    }
    
    manager.renderer.setPixelRatio(window.devicePixelRatio);
    manager.renderer.setSize(window.innerWidth, window.innerHeight);
    manager.scene.background = new Color(0x334155);

    // Camera & Parent Group (Fixes Gimbal Lock)
    manager.camera = new PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    manager.camera.position.set(0, playerRadius / 2, 0); // Camera slightly above parent origin
    
    manager.cameraParent = new Group();
    
    // ✅ KEEPING THE FIX: Closer Player Start Position (Z=5)
    manager.cameraParent.position.set(0, playerRadius, 5); // Player position in world
    
    manager.cameraParent.add(manager.camera);
    manager.scene.add(manager.cameraParent);

    // Lighting
    const light = new DirectionalLight(0xffffff, 1.5);
    light.position.set(10, 10, 10).normalize();
    manager.scene.add(light);
    manager.scene.add(new AmbientLight(0xcccccc, 0.5));

    // Event listener for window resize
    window.addEventListener('resize', manager.onWindowResize);
}

function initPhysics(manager) {
    manager.world = new World();
    manager.world.gravity.set(0, -34.34, 0); 
    
    // Player Physics Body (Sphere for smooth movement)
    const playerShape = new Sphere(playerRadius / 2); 
    manager.playerBody = new Body({
        mass: 70, 
        shape: playerShape,
        position: new Vec3(manager.cameraParent.position.x, manager.cameraParent.position.y, manager.cameraParent.position.z),
        linearDamping: 0.95,
        fixedRotation: true, 
        allowSleep: false, 
    });
    manager.world.addBody(manager.playerBody);
    
    // Collision event for robust ground check
    manager.playerBody.addEventListener('collide', (event) => {
        manager.isGrounded = true; 
    });

    // Floor Physics Body (Static)
    const floorBody = new Body({
        mass: 0, 
        shape: new Plane()
    });
    // Rotate the plane to be horizontal
    floorBody.quaternion.setFromAxisAngle(new Vec3(1, 0, 0), -Math.PI / 2); 
    manager.world.addBody(floorBody);

    // THREE.js Floor Mesh
    const floorGeometry = new PlaneGeometry( 200, 200, 20, 20 );
    
    // ⏪ REVERTED CHANGE: Restore original transparent wireframe material
    const floorMeshMaterial = new MeshBasicMaterial( { 
        color: ASSETS.FLOOR.color, 
        wireframe: true, 
        transparent: true, 
        opacity: 0.3 
    } );
    
    const floorMesh = new Mesh( floorGeometry, floorMeshMaterial );
    floorMesh.rotation.x = - Math.PI / 2;
    floorMesh.userData.assetId = ASSETS.FLOOR.id; 
    manager.scene.add( floorMesh );
}

function initDynamicObjects(manager) {
    // Create 20 random dynamic boxes the player can push
    for (let i = 0; i < 20; i++) {
        const size = Math.random() * 2 + 1; // Size between 1 and 3 meters
        const threeBoxGeometry = new BoxGeometry( size, size, size );
        const randomColor = blockColors[Math.floor(Math.random() * blockColors.length)];
        const threeBoxMaterial = new MeshBasicMaterial( { color: randomColor, wireframe: false } );
        const boxMesh = new Mesh( threeBoxGeometry, threeBoxMaterial );

        const x = Math.random() * 150 - 75; // Random x between -75 and 75
        const z = Math.random() * 150 - 75; // Random z between -75 and 75
        const y = size / 2 + 0.1; // Ensure it starts slightly above ground

        boxMesh.position.set(x, y, z);
        manager.scene.add( boxMesh );
        manager.dynamicMeshes.push(boxMesh);

        const cannonBoxShape = new Box(new Vec3(size/2, size/2, size/2));
        const cannonBoxBody = new Body({
            mass: size * 10, // Gives it mass
            shape: cannonBoxShape,
            position: new Vec3(x, y, z)
        });
        manager.world.addBody(cannonBoxBody);
        manager.dynamicBodies.push(cannonBoxBody);
    }
}

function initControls(manager) {
    const canvas = manager.renderer.domElement;
    manager.controls = new FirstPersonControls(manager.camera, manager.cameraParent, canvas);

    manager.controls.onJump = manager.handleJump; 
    manager.controls.onPlaceObject = manager.placeObject;
    manager.controls.onRotateObject = manager.rotateObject;
    manager.controls.onColorChange = manager.changeAsset;
}

function initGameMechanics(manager) {
    manager.placementTool = new PlacementTool(
        manager.scene, 
        manager.camera, 
        () => ASSETS[DECORATION_ASSET_KEYS[manager.assetIndex]]
    );
    manager.placementTool.initGhostBlock();
    manager.placementTool.updateGhostVisuals(DECORATION_ASSET_KEYS[manager.assetIndex]);
}

function setupDataListeners(manager) {
    dataService.subscribeToProject(manager.loadProject);
    
    document.getElementById('saveButton').addEventListener('click', manager.saveProject);
    document.getElementById('deleteButton').addEventListener('click', manager.deleteLastObject);
}

/**
 * Main function to initialize all parts of the scene manager.
 * @param {SceneManager} manager - The instance of the SceneManager class.
 */
export function initializeScene(manager) {
    initThree(manager);
    initPhysics(manager);
    initDynamicObjects(manager);
    initControls(manager);
    initGameMechanics(manager);
    setupDataListeners(manager);
}