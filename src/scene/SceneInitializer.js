// Utility module for setting up the initial 3D scene, physics world, and controls.

const { 
    Group, Scene, PerspectiveCamera, WebGLRenderer, Clock, 
    DirectionalLight, AmbientLight, Color, 
    BoxGeometry, MeshBasicMaterial, Mesh, PlaneGeometry, Vector3, 
    TextureLoader, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace
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
    // 1. HTML Container
    const container = document.createElement( 'div' );
    document.body.appendChild( container );
    
    // 2. RENDERER SETUP (Fixed: manager.renderer is null)
    const renderer = new WebGLRenderer( { antialias: true } );
    container.appendChild( renderer.domElement );
    manager.renderer = renderer;
    manager.renderer.outputColorSpace = SRGBColorSpace;
    manager.scene.background = new Color( 0x87ceeb);

    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( window.innerWidth, window.innerHeight );
    container.appendChild( renderer.domElement );
    manager.renderer = renderer; // Attach to manager
    
    // Set a sky background color for visibility
    manager.scene.background = new Color( 0x87ceeb );

    // 3. CAMERA PARENT/PLAYER GROUP (Fixed: manager.cameraParent is null)
    manager.cameraParent = new Group();
    // Set the initial player starting position (e.g., above the floor)
    manager.cameraParent.position.set( 0, 10, 0 ); 
    manager.scene.add( manager.cameraParent );
    
    // 4. CAMERA
    // Camera is positioned at (0,0,0) relative to its parent group
    const camera = new PerspectiveCamera( 30, window.innerWidth / window.innerHeight, 1, 1500 );
    camera.position.set( 0, playerRadius, 5); 
    manager.cameraParent.add( camera );
    manager.camera = camera; // Attach to manager

    // 5. Lighting
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
        velocity: new Vec3(0, 0, 0),
        linearDamping: 0.95, // <-- CRITICAL FIX: Use a stable low damping value
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
        shape: new Plane() // Default normal is (1, 0, 0)
    });

    floorBody.quaternion.setFromAxisAngle(new Vec3(1, 0, 0), -Math.PI / 2); 
    manager.world.addBody(floorBody);

    // THREE.js Floor Mesh
    const floorGeometry = new PlaneGeometry( 200, 200, 20, 20 );
    
    const textureLoader = new TextureLoader();

    const texture = textureLoader.load( "src/texture/grass.jpg", 
        function(loadedTexture) {
            const repeatAmount = 100;
            loadedTexture.wrapS = RepeatWrapping;
            loadedTexture.wrapT = RepeatWrapping;
            loadedTexture.repeat.set(repeatAmount, repeatAmount);

            loadedTexture.colorSpace = SRGBColorSpace;
        },
        undefined,
        function(err) {
            console.error("Texture loading failed");
        }
    );

    // Debug Material: Make floor opaque and bright red to confirm visibility
    const floorMeshMaterial = new MeshStandardMaterial( { 
        map: texture,
        side: THREE.DoubleSide,
        roughness: 1.0,
        metalness: 0.1
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
            mass: size * 10, 
            shape: cannonBoxShape,
            position: new Vec3(x, y, z),
            // Added explicit velocity and angular velocity initialization to prevent NaN
            velocity: new Vec3(0, 0, 0),
            angularVelocity: new Vec3(0, 0, 0) 
        });
        manager.world.addBody(cannonBoxBody);
        manager.dynamicBodies.push(cannonBoxBody);
    }
}

function initControls(manager) {
    // manager.renderer.domElement is now guaranteed to exist
    const canvas = manager.renderer.domElement; 
    manager.controls = new FirstPersonControls(manager.camera, manager.cameraParent, canvas);

    // When the mouse lock is lost (e.g., user presses Esc),
    // clicking the canvas again will automatically attempt to re-acquire the lock.
    canvas.addEventListener('click', () => {
        // Check if the lock is NOT already active before requesting it again
        if (document.pointerLockElement !== canvas) {
            canvas.requestPointerLock();
        }
    });

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