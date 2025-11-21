// --- Metadata for all available 3D objects and colors ---

// TODO 1: Define a structure for GLTF models once assets are available.
// For now, use simple Box/Plane definitions.

export const ASSETS = {
    // Structural Elements (Building the shell)
    FLOOR: {
        id: 'floor',
        name: 'Floor Plane',
        type: 'Plane', 
        size: [200, 200],
        color: 0x475569, // Slate gray
        isStructure: true,
        materialType: 'MeshStandardMaterial'
    },
    WALL: {
        id: 'wall',
        name: 'Simple Wall',
        type: 'Box',
        size: [15, 6, 0.3], // L x H x W
        color: 0xffffff,
        isStructure: true,
        materialType: 'MeshStandardMaterial'
    },
    
    // Furniture Items (Movable and decorative)
    SOFA: {
        id: 'sofa',
        name: 'Sofa',
        type: 'Box', // Placeholder: will be GLTF path later
        size: [3, 1, 1], // Placeholder size
        color: 0x8b5cf6, // Violet
        isStructure: false,
        materialType: 'MeshStandardMaterial'
    },
    TABLE: {
        id: 'table',
        name: 'Coffee Table',
        type: 'Box', // Placeholder
        size: [1, 0.5, 1],
        color: 0xf59e0b, // Amber
        isStructure: false,
        materialType: 'MeshStandardMaterial'
    }
};

// Array of asset keys for the user to cycle through (Q/E)
export const DECORATION_ASSET_KEYS = ['SOFA', 'TABLE', 'WALL'];