// Utility module for setting up the initial 3D scene, physics world, and controls.

const { 
    Group, Scene, PerspectiveCamera, WebGLRenderer, Clock, 
    DirectionalLight, AmbientLight, Color, 
    BoxGeometry, MeshBasicMaterial, Mesh, PlaneGeometry, Vector3, 
    TextureLoader, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace
} = window.THREE;

const COLLISION_VELOCITY_THRESHOLD = 5; // Example: 5 m/s or greater
const mapSize = 4;

const { 
    World, Body, Sphere, Plane, Box, Vec3 
} = window.CANNON;

import { FirstPersonControls } from '../controls.js';
import { 
    playerRadius, blockColors, 
} from '../constants.js';

// --- Initialization Helpers ---
/**
 * Sets up collision listeners on the player body to detect high-velocity impacts.
 * @param {SceneManager} manager
 */
function setupCollisionDetection(manager) {
    if (!manager.playerBody) {
        console.error("Cannot set up collision detection: Player body is null.");
        return;
    }

    // 'collide' event is emitted when the body collides with another body.
    manager.playerBody.addEventListener('collide', (event) => {
        const otherBody = event.body; // The body the player collided with
        const contact = event.contact; // Cannon.js contact manifold data

        // 1. Calculate the magnitude of the relative velocity at the collision point.
        // The collision event provides contact.getImpactVelocityAlongNormal()
        // or we can look at the relative velocity. For simplicity and impact,
        // let's look at the velocity of the body that hit us.
        
        // Use the total velocity of the impacting body (optional: only use non-static bodies)
        if (otherBody.mass === 0) return; // Ignore static objects like the floor/placed blocks

        const impactingVelocityMagnitude = otherBody.velocity.length();

        // 2. Check against the threshold
        if (impactingVelocityMagnitude >= COLLISION_VELOCITY_THRESHOLD) {
            
            // You can also calculate the strength based on mass * velocity, etc.
            const impactForceEstimate = otherBody.mass * impactingVelocityMagnitude;

            console.log(
                `💥 HIGH-VELOCITY IMPACT DETECTED! ` + 
                `Impacting Body Mass: ${otherBody.mass.toFixed(1)}, ` +
                `Velocity: ${impactingVelocityMagnitude.toFixed(2)} m/s, ` +
                `Threshold: ${COLLISION_VELOCITY_THRESHOLD} m/s`
            );
            console.log(`Estimated Impact Force (M*V): ${impactForceEstimate.toFixed(1)}`);
            
            // Optional: Immediately trigger the red fade effect (assuming it's bound)
            if (manager.fadeScreenToRed) {
                // Fade to red over a short time, scaling opacity based on velocity
                const opacity = Math.min(1.0, (impactingVelocityMagnitude / 15));
                manager.fadeScreenToRed(new Color(0xFF0000), opacity, 0.2, () => {
                     // Optionally fade out here
                });
            }
        }
    });
}

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

    // ADD THIS LINE:
    manager.renderer.shadowMap.enabled = true; // Enables shadow mapping
    // Optional (but good practice): Configure the shadow map type
    manager.renderer.shadowMap.type = THREE.PCFSoftShadowMap;// 2. RENDERER SETUP (Fixed: manager.renderer is null)

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
    const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );    camera.position.set( 0, playerRadius, 0); 
    manager.cameraParent.add( camera );
    manager.camera = camera; // Attach to manager

    // 5. Lighting
    
    // DELETE: const light = new DirectionalLight(0xffffff, 1.5);
    // DELETE: light.position.set(10, 10, 10).normalize();
    // DELETE: manager.scene.add(light);

    // --- NEW DYNAMIC LIGHT SETUP ---
    
// a. Create a Directional Light for the "Sun/Moon"
    const dynamicSun = new DirectionalLight(0xffffff, 2.0);
    dynamicSun.position.set(10, 50, 10); 
    
    // ADD THESE LINES:
    dynamicSun.castShadow = true; // CRITICAL: This light will cast shadows

    // OPTIONAL: Configure Shadow Camera and Bounds (VERY IMPORTANT FOR DIRECTIONAL LIGHT)
    // Adjust these values based on your scene size to avoid shadow clipping/banding.
    const shadowSize = 100;
    dynamicSun.shadow.camera.left = -shadowSize;
    dynamicSun.shadow.camera.right = shadowSize;
    dynamicSun.shadow.camera.top = shadowSize;
    dynamicSun.shadow.camera.bottom = -shadowSize;
    dynamicSun.shadow.camera.near = 0.5;
    dynamicSun.shadow.camera.far = 150;
    dynamicSun.shadow.mapSize.width = 1024 * 2**mapSize; // Shadow texture resolution (must be power of 2)
    dynamicSun.shadow.mapSize.height = 1024 * 2**mapSize;

    manager.scene.add(dynamicSun);
    manager.dynamicLight = dynamicSun;
    
    // b. Ambient Light (remains static)
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
        mass: 1, 
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
    const floorGeometry = new PlaneGeometry( 50, 50, 20, 20 );
    
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
    floorMesh.receiveShadow = true;
    manager.scene.add( floorMesh );

    const wallLength = 50;
    const wallHeight = 4;
    const wallThickness = 0.5;
    const halfLength = wallLength / 2;
    const buryDepth = 1;
    const centerHeight = (wallHeight / 2) - buryDepth;
    const fenceTexturePath = "src/texture/fence.png";

    const fenceTexture = textureLoader.load(fenceTexturePath,
        function(loadedTexture) {
            loadedTexture.wrapS = RepeatWrapping;
            loadedTexture.wrapT = RepeatWrapping;
            loadedTexture.colorSpace = SRGBColorSpace;
            loadedTexture.repeat.set(5, 1);

            loadedTexture.magFilter = THREE.LinearFilter;
            loadedTexture.minFilter = THREE.LinearMipmapLinearFilter;
        }
    );

    const fenceMaterial = new MeshBasicMaterial({
        map: fenceTexture,
        side: THREE.FrontSide,
        color: 0xffffff,
        transparent: true,
        opacity: 1,
    });

    const wallGeomtry = new BoxGeometry(wallLength, wallHeight, wallThickness);

    const physicsWallShape = new Box(new Vec3(halfLength, wallHeight / 2, wallThickness / 2));

    const wallPositions = [
        { position: new Vec3(0, centerHeight, halfLength), rotation: 0 },
        { position: new Vec3(0, centerHeight, -halfLength), rotation: 0 },
        { position: new Vec3(-halfLength, centerHeight, 0), rotation: Math.PI / 2 },
        { position: new Vec3(halfLength, centerHeight, 0), rotation: Math.PI / 2 }
    ];

    wallPositions.forEach(wallData => {
        const wallBody = new Body({
            mass: 0,
            shape: physicsWallShape,
            position: wallData.position
        });

        if (wallData.rotation !== 0) {
            wallBody.quaternion.setFromAxisAngle(new Vec3(0, 1, 0), wallData.rotation);
        }

        manager.world.addBody(wallBody);

        const wallMesh = new Mesh(wallGeomtry, fenceMaterial);

        wallMesh.position.copy(wallData.position);
        wallMesh.rotation.y = wallData.rotation;

        if (wallData.rotation !== 0) {
            fenceTexture.repeat.set(100, 1);
        } else {
            fenceTexture.repeat.set(100, 1);
        }

        manager.scene.add(wallMesh);
    });
}

function initDynamicObjects(manager) {
    // Create 20 random dynamic boxes the player can push
    for (let i = 0; i < 20; i++) {
        const size = Math.random() * 2 + 1; // Size between 1 and 3 meters
        const threeBoxGeometry = new BoxGeometry( size, size, size );
        const randomColor = blockColors[Math.floor(Math.random() * blockColors.length)];
        const threeBoxMaterial = new MeshBasicMaterial( { color: randomColor, wireframe: false } );
        const boxMesh = new Mesh( threeBoxGeometry, threeBoxMaterial );
        boxMesh.castShadow = true;

        const x = Math.random() * 50 - (50 / 2); // Random x between -75 and 75
        const z = Math.random() * 50 - (50 / 2); // Random z between -75 and 75
        const y = size / 2 + 0.1; // Ensure it starts slightly above ground

        boxMesh.position.set(x, y, z);
        manager.scene.add( boxMesh );
        manager.dynamicMeshes.push(boxMesh);

        const cannonBoxShape = new Box(new Vec3(size/2, size/2, size/2));
        const cannonBoxBody = new Body({
            mass: size * 10, 
            shape: cannonBoxShape,
            position: new Vec3(x, y, z)
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

    manager.controls.onFadeScreen = () => {
        // Fade to red (0xFF0000) over 0.3 seconds.
        manager.fadeScreenToRed();
    };

    manager.controls.onJump = manager.handleJump; 
    manager.controls.onPlaceObject = manager.placeObject;
    manager.controls.onRotateObject = manager.rotateObject;
    manager.controls.onColorChange = manager.changeAsset;
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
    setupCollisionDetection(manager);
}