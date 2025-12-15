// pentominos.js - Defines the 12 Pentomino shapes

const {
    Color, BoxGeometry, MeshBasicMaterial, Group, Mesh, Vector3
} = window.THREE;

const {
    Body, Box, Vec3
} = window.CANNON;

/**
 * Global constant defining the size (side length) of the individual unit cube 
 * that makes up each pentomino piece.
 */
const PENTOMINO_UNIT_SIZE = 5; // 1 unit side length

/**
 * Defines the relative coordinates (x, y, z) of the 5 unit cubes 
// ... (rest of the PENTOMINO_SHAPES object remains the same)
 */
const PENTOMINO_SHAPES = {
    // I (Straight) - 5x1
    I: [ [-2, 0, 0], [-1, 0, 0], [0, 0, 0], [1, 0, 0], [2, 0, 0] ],

    // L (Long Leg)
    L: [ [0, 0, 0], [-1, 0, 0], [-2, 0, 0], [-3, 0, 0], [0, 1, 0] ],

    // P (Short Leg) - Like a capital 'P'
    P: [ [0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 2, 0] ],

    // T (T-shape)
    T: [ [-1, 0, 0], [0, 0, 0], [1, 0, 0], [0, 1, 0], [0, -1, 0] ],

    // U (U-shape)
    U: [ [0, 0, 0], [2, 0, 0], [0, 1, 0], [1, 1, 0], [2, 1, 0] ],

    // V (Corner)
    V: [ [0, 0, 0], [0, 1, 0], [0, 2, 0], [1, 2, 0], [2, 2, 0] ],

    // W (Wiggly/Triple Corner)
    W: [ [-1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 2, 0] ],

    // X (Center Cross)
    X: [ [0, 0, 0], [-1, 0, 0], [1, 0, 0], [0, 1, 0], [0, -1, 0] ],

    // Y (Y-shape/Long line with center offset)
    Y: [ [-2, 0, 0], [-1, 0, 0], [0, 0, 0], [1, 0, 0], [0, 1, 0] ],

    // Z (Zig-Zag)
    Z: [ [0, 0, 0], [1, 0, 0], [0, 1, 0], [-1, 1, 0], [-2, 1, 0] ],

    // F (Twisted/Pinwheel)
    F: [ [0, 0, 0], [1, 0, 0], [-1, 1, 0], [0, 1, 0], [0, 2, 0] ],

    // N (Diagonal Line)
    N: [ [-2, 0, 0], [-1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0] ],
};

/**
 * Generates the geometry and physics body for a single Pentomino asset.
 * @param {string} key - The single-letter key of the Pentomino.
 * @param {number} color - The hexadecimal color for the piece.
 * @returns {object} An object containing methods to create the mesh and body.
 */
function createPentominoAsset(key, color) {
    const relativeCoords = PENTOMINO_SHAPES[key];
    const unitSize = PENTOMINO_UNIT_SIZE; // <--- USES THE NEW CONSTANT

    return {
        id: `PENT_${key}`,
        key: key,
        color: color,
        // The overall size is determined by the bounding box of the coordinates
        size: [
            // Max dimension * 2 (to cover both positive and negative) + 1 (for the unit cube itself)
            Math.max(...relativeCoords.map(c => Math.abs(c[0]))) * 2 * unitSize + unitSize,
            Math.max(...relativeCoords.map(c => Math.abs(c[1]))) * 2 * unitSize + unitSize,
            unitSize // Thickness
        ],

        /**
         * Creates a THREE.js Mesh Group representing the piece.
         * @param {number} thickness - The thickness (Z-dimension) of the piece.
         * @returns {window.THREE.Group}
         */
        createMesh: (thickness = unitSize) => {
            const group = new Group();
            // Dimensions are based on the unit size
            const geometry = new BoxGeometry(unitSize, unitSize, thickness); 
            const material = new MeshBasicMaterial({ color: color, wireframe: false });

            relativeCoords.forEach(([x, y, z]) => {
                const cube = new Mesh(geometry, material);
                // Position each cube relative to the group's center
                cube.position.set(x * unitSize, y * unitSize, z * unitSize);
                group.add(cube);
            });

            group.userData.assetId = `PENT_${key}`;
            return group;
        },

        /**
         * Creates a CANNON.js Body representing the piece (mass: 20 for dynamic, falling).
         * @param {window.THREE.Vector3} position - The world position.
         * @param {window.THREE.Euler} rotation - The world rotation.
         * @returns {window.CANNON.Body}
         */
        createBody: (position, rotation) => {
            // Half-extents for the unit cube
            const halfExtents = new Vec3(unitSize / 2, unitSize / 2, unitSize / 2);
            const cubeShape = new Box(halfExtents);

            const body = new Body({
                mass: 200, // Default dynamic mass
                position: new Vec3(position.x, position.y, position.z),
            });
            body.quaternion.setFromEuler(rotation.x, rotation.y, rotation.z);

            // Add each cube as a child shape to the main body, offset by its coordinates
            relativeCoords.forEach(([x, y, z]) => {
                const offset = new Vec3(x * unitSize, y * unitSize, z * unitSize);
                body.addShape(cubeShape, offset);
            });

            return body;
        }
    };
}

// Define the 12 Pentomino assets with distinct colors
export const PENTOMINO_ASSETS = [
    createPentominoAsset('F', 0x00FF00), // Green
    createPentominoAsset('I', 0x0000FF), // Blue
    createPentominoAsset('L', 0xFF8800), // Orange
    createPentominoAsset('P', 0xFF00FF), // Magenta
    createPentominoAsset('N', 0x00FFFF), // Cyan
    createPentominoAsset('T', 0xFF0000), // Red
    createPentominoAsset('U', 0xFFFF00), // Yellow
    createPentominoAsset('V', 0x8800FF), // Purple
    createPentominoAsset('W', 0x888888), // Gray
    createPentominoAsset('X', 0x008888), // Teal
    createPentominoAsset('Y', 0xFFFFFF), // White
    createPentominoAsset('Z', 0x8B4513)  // Brown (SaddleBrown)
];

export const PENTOMINO_KEYS = PENTOMINO_ASSETS.map(asset => asset.key);