import { FirstPersonControls } from './controls.js';
import { 
    fixedTimeStep, 
    maxSubSteps, 
    playerRadius, 
    jumpVelocity, 
    blockColors, 
    colorIndex, 
    cycleColorIndex,
    _cameraDirection, 
    _rayStart, 
    _rayEnd, 
    _rayResult
} from './constants.js';

// Access globally loaded libraries
const { 
    Clock, PerspectiveCamera, WebGLRenderer, Scene, Mesh, BoxGeometry, MeshBasicMaterial, 
    PlaneGeometry, DirectionalLight, AmbientLight, Color, Vector3, MathUtils, 
    EventDispatcher 
} = window.THREE;

const { 
    Body, World, Plane, Box, Sphere, Vec3
} = window.CANNON;


// =====================================================================
// GLOBAL STATE VARIABLES
// =====================================================================
let camera, scene, renderer, controls, clock;
let world, playerBody, ghostMesh;
let boxMeshes = [], boxBodies = [];
let isGrounded = false; 

// =====================================================================
// GAME ACTIONS (Called by Controls)
// =====================================================================

/**
 * Executes a jump if the player is grounded.
 */
function handleJump() {
    if (isGrounded && playerBody) { 
        playerBody.velocity.y = jumpVelocity;
        isGrounded = false; // Prevents spamming jump
    }
}

/**
 * Cycles color and updates visuals.
 */
function handleColorChange() {
    updateGhostColor();
    updateColorSelectionUI();
}

/**
 * Creates a static physics block and a visual mesh at the ghost's position.
 */
function placeBox() {
    if (!camera || !world || !playerBody || !scene || !ghostMesh) return;

    const finalPosition = ghostMesh.position;
    const size = 3; 

    // 1. Create Three.js Mesh
    const threeBoxGeometry = new BoxGeometry(size, size, size);
    const threeBoxMaterial = new MeshBasicMaterial({
        color: blockColors[colorIndex], 
        wireframe: false
    });
    const boxMesh = new Mesh(threeBoxGeometry, threeBoxMaterial);
    boxMesh.position.copy(finalPosition);
    scene.add(boxMesh);
    boxMeshes.push(boxMesh);

    // 2. Create Cannon.js Body (Static/Immovable: mass: 0)
    const cannonBoxShape = new Box(new Vec3(size / 2, size / 2, size / 2));
    const cannonBoxBody = new Body({
        mass: 0, 
        shape: cannonBoxShape,
        position: new Vec3(finalPosition.x, finalPosition.y, finalPosition.z)
    });

    world.addBody(cannonBoxBody);
    boxBodies.push(cannonBoxBody);
}


// =====================================================================
// VISUAL & UI UPDATES
// =====================================================================

/**
 * Sets the ghost mesh color based on the current colorIndex.
 */
function updateGhostColor() {
    if (ghostMesh && ghostMesh.material) {
        ghostMesh.material.color.setHex(blockColors[colorIndex]);
    }
}

/**
 * Initializes the translucent preview block.
 */
function initGhostBlock() {
    const size = 3;
    const ghostGeometry = new BoxGeometry(size, size, size);
    const ghostMaterial = new MeshBasicMaterial({
        color: blockColors[colorIndex], 
        wireframe: true,
        transparent: true,
        opacity: 0.3,
        depthWrite: false
    });
    ghostMesh = new Mesh(ghostGeometry, ghostMaterial);
    scene.add(ghostMesh);
    updateGhostColor();
}

/**
 * Calculates the snapped position and moves the ghost block.
 */
function updateGhostBlock() {
    if (!camera || !playerBody || !ghostMesh) return;

    const size = 3; 
    const placementDistance = playerRadius + size / 2 + 0.5; // Distance in front of the player
    
    camera.getWorldDirection(_cameraDirection);
    _cameraDirection.normalize();

    // Start position: in front of the player, lifted slightly
    const startPosition = new Vec3(
        playerBody.position.x + _cameraDirection.x * placementDistance,
        playerBody.position.y + 0.5, 
        playerBody.position.z + _cameraDirection.z * placementDistance
    );

    const gridStep = size;
    const baseElevation = size / 2; // Blocks rest on the ground at Y=1.5

    // Apply grid snapping (nearest multiple of gridStep)
    const snappedX = Math.round(startPosition.x / gridStep) * gridStep;
    const snappedZ = Math.round(startPosition.z / gridStep) * gridStep;
    
    // Calculate Y grid level and offset by baseElevation
    const verticalGridOffset = startPosition.y - baseElevation;
    const snappedY = Math.round(verticalGridOffset / gridStep) * gridStep + baseElevation;

    const finalPosition = new Vec3(snappedX, snappedY, snappedZ);

    ghostMesh.position.set(finalPosition.x, finalPosition.y, finalPosition.z);
}

/**
 * Creates the clickable color swatches in the bottom-left panel.
 */
function createColorPaletteUI() {
    const paletteContainer = document.getElementById('color-palette');
    paletteContainer.innerHTML = ''; 

    blockColors.forEach((hexColor, index) => {
        const colorObj = new Color(hexColor);
        const cssColor = '#' + colorObj.getHexString();

        const swatch = document.createElement('div');
        swatch.id = `color-swatch-${index}`;
        swatch.className = 'w-8 h-8 rounded-full border-2 border-white/50 transition-all duration-150 cursor-pointer';
        swatch.style.backgroundColor = cssColor;
        
        // Click handler for direct selection
        swatch.addEventListener('click', () => {
            cycleColorIndex(index - colorIndex); // Calculate direction to move
            handleColorChange();
        });

        paletteContainer.appendChild(swatch);
    });

    updateColorSelectionUI();
}

/**
 * Updates the visual highlight on the selected color swatch.
 */
function updateColorSelectionUI() {
    const paletteContainer = document.getElementById('color-palette');
    const swatches = paletteContainer.children;

    // Remove selection style from all
    for (let i = 0; i < swatches.length; i++) {
        swatches[i].classList.remove('ring-4', 'ring-offset-2', 'ring-yellow-400', 'ring-offset-gray-900/70', 'scale-110');
        swatches[i].classList.add('scale-100');
    }

    // Add selection style to the current index
    const selectedSwatch = document.getElementById(`color-swatch-${colorIndex}`);
    if (selectedSwatch) {
        selectedSwatch.classList.add('ring-4', 'ring-offset-2', 'ring-yellow-400', 'ring-offset-gray-900/70', 'scale-110');
    }
}


// =====================================================================
// INITIALIZATION AND MAIN LOOP
// =====================================================================

function init() {
    const container = document.body;

    // --- RENDERER & SCENE SETUP ---
    renderer = new WebGLRenderer( { antialias: true } );
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( window.innerWidth, window.innerHeight );
    container.appendChild( renderer.domElement );

    scene = new Scene();
    scene.background = new Color( 0x334155 );

    // --- CAMERA ---
    camera = new PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 0.1, 1000 );
    camera.position.set( 0, playerRadius + 5, 50 ); 

    // --- CONTROLS & CLOCK ---
    controls = new FirstPersonControls( camera, renderer.domElement );
    // Map game actions to control input events
    controls.onJump = handleJump;
    controls.onPlaceBox = placeBox;
    controls.onColorChange = handleColorChange;

    clock = new Clock();

    // --- LIGHTING ---
    const light = new DirectionalLight( 0xffffff, 1.5 );
    light.position.set( 10, 10, 10 ).normalize();
    scene.add( light );
    scene.add( new AmbientLight( 0xcccccc, 0.5 ) );

    // --- CANNON.JS WORLD SETUP ---
    world = new World();
    world.gravity.set( 0, -9.82, 0 ); 

    // --- PLAYER BODY (Sphere for smooth collision) ---
    const playerShape = new Sphere( playerRadius );
    playerBody = new Body({
        mass: 50, 
        shape: playerShape,
        position: new Vec3(camera.position.x, camera.position.y, camera.position.z),
        linearDamping: 0.95, 
        fixedRotation: true, // Prevent player from tipping over
    });
    world.addBody(playerBody);

    // --- FLOOR BODY ---
    const floorBody = new Body({
        mass: 0, // Static
        shape: new Plane()
    });
    // Rotate the plane to be horizontal
    floorBody.quaternion.setFromAxisAngle(new Vec3(1, 0, 0), -Math.PI / 2); 
    world.addBody(floorBody);

    // THREE.js Floor Mesh
    const floorGeometry = new PlaneGeometry( 200, 200, 20, 20 );
    const floorMeshMaterial = new MeshBasicMaterial( { color: 0x22c55e, wireframe: true, transparent: true, opacity: 0.3 } );
    const floorMesh = new Mesh( floorGeometry, floorMeshMaterial );
    floorMesh.rotation.x = - Math.PI / 2;
    scene.add( floorMesh );

    // --- INITIAL DYNAMIC BOXES ---
    // Create 20 random dynamic boxes the player can push
    for (let i = 0; i < 20; i++) {
        const size = Math.random() * 5 + 1;
        const threeBoxGeometry = new BoxGeometry( size, size, size );
        const randomColor = blockColors[Math.floor(Math.random() * blockColors.length)];
        const threeBoxMaterial = new MeshBasicMaterial( { color: randomColor, wireframe: false } );
        const boxMesh = new Mesh( threeBoxGeometry, threeBoxMaterial );

        const x = Math.random() * 150 - 75;
        const z = Math.random() * 150 - 75;
        const y = size / 2 + 0.1; // Ensure it starts slightly above ground

        boxMesh.position.set(x, y, z);
        scene.add( boxMesh );
        boxMeshes.push(boxMesh);

        const cannonBoxShape = new Box(new Vec3(size/2, size/2, size/2));
        const cannonBoxBody = new Body({
            mass: size * 10, // Gives it mass
            shape: cannonBoxShape,
            position: new Vec3(x, y, z)
        });
        world.addBody(cannonBoxBody);
        boxBodies.push(cannonBoxBody);
    }

    // --- INITIALIZE GHOST BLOCK & UI ---
    initGhostBlock();
    createColorPaletteUI();

    // Event Listeners
    window.addEventListener( 'resize', onWindowResize );
    
    // Start the animation loop
    animate();
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize( window.innerWidth, window.innerHeight );
    controls.handleResize();
}

function animate() {
    requestAnimationFrame( animate );

    const delta = clock.getDelta();

    // 1. Update Cannon.js Physics World
    world.step(fixedTimeStep, delta, maxSubSteps);

    // 2. Control Camera Look (Rotation)
    controls.update( delta );

    // 3. Update Ghost Block Position
    updateGhostBlock();

    // 4. Raycast Ground Check
    
    // Raycast start: center of the player sphere
    _rayStart.set(playerBody.position.x, playerBody.position.y, playerBody.position.z);
    // Raycast end: slightly below the player's base
    _rayEnd.set(playerBody.position.x, playerBody.position.y - playerRadius - 0.1, playerBody.position.z); 

    _rayResult.reset(); 
    
    // Check for hits against any body except the player itself
    world.raycastClosest(_rayStart, _rayEnd, {}, _rayResult);

    // Player is grounded if the ray hits something
    isGrounded = (_rayResult.hasHit && _rayResult.body !== playerBody);


    // 5. Apply Player Movement to Cannon Body (Velocity)
    camera.getWorldDirection(_cameraDirection);
    _cameraDirection.y = 0; // Only care about horizontal direction
    _cameraDirection.normalize(); 

    const rightVector = new Vector3();
    // Calculate vector perpendicular to camera direction
    rightVector.crossVectors(new Vector3(0, 1, 0), _cameraDirection); 
    rightVector.normalize();

    const moveSpeed = controls.movementSpeed;
    const inputVelocity = new Vector3(0, 0, 0);

    if (controls.moveForward) inputVelocity.addScaledVector(_cameraDirection, 1);
    if (controls.moveBackward) inputVelocity.addScaledVector(_cameraDirection, -1);
    if (controls.moveLeft) inputVelocity.addScaledVector(rightVector, 1);
    if (controls.moveRight) inputVelocity.addScaledVector(rightVector, -1);

    if (inputVelocity.lengthSq() > 0) {
        inputVelocity.normalize().multiplyScalar(moveSpeed);
    }

    // Apply horizontal velocity to the player body
    playerBody.velocity.x = inputVelocity.x;
    playerBody.velocity.z = inputVelocity.z;


    // 6. Synchronize Three.js Meshes with Cannon.js Bodies
    camera.position.copy(playerBody.position); // Update Camera position to match player physics body

    for (let i = 0; i < boxMeshes.length; i++) {
        boxMeshes[i].position.copy(boxBodies[i].position);
        boxMeshes[i].quaternion.copy(boxBodies[i].quaternion);
    }

    // 7. Render
    renderer.render( scene, camera );
}

// Start the application after all necessary modules and libraries are loaded
window.onload = function() {
    if (window.THREE && window.CANNON) {
        init();
    } else {
        console.error("THREE.js or CANNON.js is not loaded. Check script tags in index.html.");
    }
}