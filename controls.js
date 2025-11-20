import { 
    _lookDirection, 
    _spherical, 
    _targetPosition,
    blockColors,
    cycleColorIndex
} from './constants.js';

const { MathUtils, EventDispatcher, Vector3 } = window.THREE;

/**
 * Base Control class to extend THREE.EventDispatcher functionality.
 */
class Controls extends EventDispatcher {
    constructor( object, domElement ) {
        super();
        this.object = object;
        this.domElement = domElement || document;
        this.enabled = true;
        
        // Callback functions for game actions, set by the main game loop
        this.onJump = () => {};
        this.onPlaceBox = () => {};
        this.onColorChange = () => {};
    }
    connect() {}
    disconnect() {}
    dispose() { this.disconnect(); }
    update() {}
}


/**
 * FirstPersonControls: Handles camera rotation and movement input state.
 */
export class FirstPersonControls extends Controls {

    constructor( object, domElement = null ) {
        super( object, domElement );

        this.movementSpeed = 25.0;
        this.lookSpeed = 0.005;
        this.lookVertical = true;
        this.activeLook = true;
        
        // Input State (Publicly accessible for game.js to read)
        this.isPointerLocked = false;
        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;

        // Internal State
        this._pointerX = 0;
        this._pointerY = 0;
        this._viewHalfX = 0;
        this._viewHalfY = 0;
        this._lat = 0;
        this._lon = 0;

        // Bind event handlers
        this._onPointerMove = this._onPointerMove.bind( this );
        this._onPointerDown = this._onPointerDown.bind( this );
        this._onPointerUp = this._onPointerUp.bind( this );
        this._onContextMenu = this._onContextMenu.bind( this );
        this._onKeyDown = this._onKeyDown.bind( this );
        this._onKeyUp = this._onKeyUp.bind( this );

        if ( domElement !== null ) {
            this.connect( domElement );
            this.handleResize();
        }

        this._setOrientation();
    }

    connect( element ) {
        super.connect( element );
        window.addEventListener( 'keydown', this._onKeyDown );
        window.addEventListener( 'keyup', this._onKeyUp );
        this.domElement.addEventListener( 'pointermove', this._onPointerMove );
        this.domElement.addEventListener( 'pointerdown', this._onPointerDown );
        this.domElement.addEventListener( 'pointerup', this._onPointerUp );
        this.domElement.addEventListener( 'contextmenu', this._onContextMenu );
        document.addEventListener('pointerlockchange', () => {
            this.isPointerLocked = (document.pointerLockElement === this.domElement);
        });
    }

    disconnect() {
        window.removeEventListener( 'keydown', this._onKeyDown );
        window.removeEventListener( 'keyup', this._onKeyUp );
        this.domElement.removeEventListener( 'pointermove', this._onPointerMove );
        this.domElement.removeEventListener( 'pointerdown', this._onPointerDown );
        this.domElement.removeEventListener( 'pointerup', this._onPointerUp );
        this.domElement.removeEventListener( 'contextmenu', this._onContextMenu );
    }

    handleResize() {
        this._viewHalfX = window.innerWidth / 2;
        this._viewHalfY = window.innerHeight / 2;
    }

    update( delta ) {
        if ( this.enabled === false ) return;

        let actualLookSpeed = delta * this.lookSpeed;
        if ( ! this.activeLook ) actualLookSpeed = 0;

        // 1. Update pitch/yaw based on mouse movement
        this._lon += this._pointerX * actualLookSpeed;
        if ( this.lookVertical ) this._lat -= this._pointerY * actualLookSpeed;

        // Clear pointer movement for next frame
        this._pointerX = 0;
        this._pointerY = 0;

        // 2. Clamp latitude and calculate new look vector
        this._lat = Math.max( - 85, Math.min( 85, this._lat ) );

        let phi = MathUtils.degToRad( 90 - this._lat );
        const theta = MathUtils.degToRad( this._lon );

        const position = this.object.position;
        _targetPosition.setFromSphericalCoords( 1, phi, theta ).add( position );
        this.object.lookAt( _targetPosition );
    }

    _setOrientation() {
        const quaternion = this.object.quaternion;
        _lookDirection.set( 0, 0, - 1 ).applyQuaternion( quaternion );
        _spherical.setFromVector3( _lookDirection );

        this._lat = 90 - MathUtils.radToDeg( _spherical.phi );
        this._lon = MathUtils.radToDeg( _spherical.theta );
    }

    // --- Private Event Handlers ---

    _onPointerDown( event ) {
        // Request pointer lock on the first click
        if (!document.pointerLockElement) {
            this.domElement.requestPointerLock();
        } 
        // If locked AND it's a left click (button 0), trigger block placement action
        else if (event.button === 0) {
            this.onPlaceBox();
        }
    }

    _onPointerUp( event ) {
        // No action needed for up event currently
    }

    _onPointerMove( event ) {
        if (document.pointerLockElement === this.domElement) {
            this._pointerX = event.movementX;
            this._pointerY = event.movementY;
        } else if ( this.domElement === document ) {
            this._pointerX = event.pageX - this._viewHalfX;
            this._pointerY = event.pageY - this._viewHalfY;
        } else {
            this._pointerX = event.pageX - this.domElement.offsetLeft - this._viewHalfX;
            this._pointerY = event.pageY - this.domElement.offsetTop - this._viewHalfY;
        }
    }

    _onKeyDown( event ) {
        switch ( event.code ) {
            case 'ArrowUp': case 'KeyW': this.moveForward = true; break;
            case 'ArrowLeft': case 'KeyA': this.moveLeft = true; break;
            case 'ArrowDown': case 'KeyS': this.moveBackward = true; break;
            case 'ArrowRight': case 'KeyD': this.moveRight = true; break;
            
            // Handle Jump (Spacebar)
            case 'Space': 
                this.onJump();
                break;
            
            // Handle Color Cycle Backward (Q)
            case 'KeyQ':
                cycleColorIndex(-1);
                this.onColorChange();
                break;
            
            // Handle Color Cycle Forward (E)
            case 'KeyE':
                cycleColorIndex(1);
                this.onColorChange();
                break;
        }
    }

    _onKeyUp( event ) {
        switch ( event.code ) {
            case 'ArrowUp': case 'KeyW': this.moveForward = false; break;
            case 'ArrowLeft': case 'KeyA': this.moveLeft = false; break;
            case 'ArrowDown': case 'KeyS': this.moveBackward = false; break;
            case 'ArrowRight': case 'KeyD': this.moveRight = false; break;
        }
    }

    _onContextMenu( event ) {
        event.preventDefault();
    }
}