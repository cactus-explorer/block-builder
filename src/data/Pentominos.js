// pentominos.js - Defines the 12 Pentomino shapes

const {
    Color, BoxGeometry, MeshBasicMaterial, Group, Mesh, Vector3,
    TextureLoader
} = window.THREE;

const {
    Body, Box, Vec3
} = window.CANNON;

/**
 * Global constant defining the size (side length) of the individual unit cube 
 * that makes up each pentomino piece.
 */
const PENTOMINO_UNIT_SIZE = 5;

// --- TEXTURE LOADING ---
const textureLoader = new TextureLoader();
// Load the texture once and reuse it for all pentominoes.
// The second argument is a callback for when loading is complete (optional here).
const pentominoTexture = textureLoader.load('src/texture/textures/metal_plate_diff_4k.jpg');
const dispMap = textureLoader.load('src/texture/textures/metal_plate_disp_4k.png');
const metal = textureLoader.load('src/texture/textures/metal_plate_metal_4k.jpg');
const nor = textureLoader.load('src/texture/textures/metal_plate_nor_gl_4k.jpg');
const rough = textureLoader.load('src/texture/textures/metal_plate_rough_4k.jpg');


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
        // --- UPDATED MATERIAL: Uses the loaded texture ---
            const material = new MeshBasicMaterial({ 
                map: pentominoTexture, // Apply the texture
                color: color,          // This color will now act as a color tint over the texture
                wireframe: false
            });
            material.displacementMap = dispMap;
            material.roughnessMap = rough;
            material.metalnessMap = metal;
            material.normalMap  = nor;
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
    // Original: 0x00FF00 (Bright Green) -> Pastel Green/Mint
    createPentominoAsset('F', 0x98FB98), 

    // Original: 0x0000FF (Bright Blue) -> Pastel Blue/Sky Blue
    createPentominoAsset('I', 0xAEC6E9), 

    // Original: 0xFF8800 (Bright Orange) -> Pastel Orange/Peach
    createPentominoAsset('L', 0xFFDAC1), 

    // Original: 0xFF00FF (Bright Magenta) -> Pastel Pink/Lavender
    createPentominoAsset('P', 0xFACBEA), 

    // Original: 0x00FFFF (Bright Cyan) -> Pastel Cyan/Pale Turquoise
    createPentominoAsset('N', 0xAFEEEE), 

    // Original: 0xFF0000 (Bright Red) -> Pastel Red/Coral Pink
    createPentominoAsset('T', 0xFFB3BA), 

    // Original: 0xFFFF00 (Bright Yellow) -> Pastel Yellow/Cream
    createPentominoAsset('U', 0xFFFFAD), 

    // Original: 0x8800FF (Bright Purple) -> Pastel Lavender/Wisteria
    createPentominoAsset('V', 0xC3B1E1), 

    // Original: 0x888888 (Medium Gray) -> Light Gray/Silver
    createPentominoAsset('W', 0xD3D3D3), 

    // Original: 0x008888 (Teal) -> Pastel Teal/Aquamarine
    createPentominoAsset('X', 0x7FFFD4), 

    // Original: 0xFFFFFF (White) -> Keep White (Pastel is color + white)
    createPentominoAsset('Y', 0xFFFFFF), 

    // Original: 0x8B4513 (Brown/SaddleBrown) -> Tan/Light Beige
    createPentominoAsset('Z', 0xF5F5DC)  
];

export const PENTOMINO_KEYS = PENTOMINO_ASSETS.map(asset => asset.key);