// --- Handles the ghost block and snap-to-grid/wall logic ---

import { ASSETS } from '../data/AssetCatalog.js';

// Corrected import to use the globally loaded THREE object
const { BoxGeometry, MeshBasicMaterial, Mesh, Raycaster, Vector2, Vector3 } = window.THREE;

export class PlacementTool {
    constructor(scene, camera, getAssetDataCallback) {
        this.scene = scene;
        this.camera = camera;
        this.getAssetData = getAssetDataCallback; // Callback to get current asset info
        this.ghostMesh = null;
        this.rotationY = 0; // Current rotation of the ghost block
        
        this.raycaster = new Raycaster();
        this.pointer = new Vector2();
        
        // Define objects that the raycaster should hit (all placed objects + the permanent floor)
        this.placeableSurfaces = []; 
    }

    initGhostBlock() {
        // TODO 1: Initialize the ghost mesh (transparent, wireframe box) and add to scene.
        // Use a generic placeholder size for now.
        const ghostGeometry = new BoxGeometry(1, 1, 1);
        const ghostMaterial = new MeshBasicMaterial({
            color: 0xffffff, 
            wireframe: true,
            transparent: true,
            opacity: 0.5,
            depthWrite: false
        });
        this.ghostMesh = new Mesh(ghostGeometry, ghostMaterial);
        this.scene.add(this.ghostMesh);
    }
    
    updatePlaceableSurfaces(meshes) {
        // Called by SceneManager whenever the placed objects list changes
        this.placeableSurfaces = meshes;
    }

    updateGhostVisuals(assetKey) {
        const asset = ASSETS[assetKey];
        if (!asset || !this.ghostMesh) return;
        
        // TODO 2: Update the ghost mesh's geometry and color based on the selected asset.
        const [w, h, d] = asset.size || [1, 1, 1];
        
        // Dispose and create new geometry if necessary (simplest approach for MVP)
        this.ghostMesh.geometry.dispose();
        this.ghostMesh.geometry = new BoxGeometry(w, h, d);
        this.ghostMesh.material.color.setHex(asset.color || 0xcccccc);
    }
    
    rotateGhost(angle) {
        // TODO 3: Update the rotationY property and apply to the ghost mesh.
        this.rotationY += angle;
        this.ghostMesh.rotation.y = this.rotationY;
    }

    updateGhostPosition(assetKey) {
        if (!this.ghostMesh) return;
        
        // 1. Raycast forward from the camera
        this.raycaster.setFromCamera(this.pointer, this.camera);
        
        // TODO 4: Find the intersection point with the permanent floor (index 0) or placed walls.
        // For MVP, let's just intersect with the permanent floor plane.
        const intersects = this.raycaster.intersectObjects(this.scene.children, false); 
        
        if (intersects.length > 0) {
            const intersect = intersects.find(i => i.object.userData.assetId === ASSETS.FLOOR.id); // Only hit the floor

            if (intersect) {
                const point = intersect.point;
                const asset = ASSETS[assetKey];
                const gridStep = 1; // Simplest grid size

                // 2. Snap to Grid (X and Z)
                const snappedX = Math.round(point.x / gridStep) * gridStep;
                const snappedZ = Math.round(point.z / gridStep) * gridStep;
                
                // 3. Set elevation (Y) based on asset height.
                const snappedY = asset.size ? asset.size[1] / 2 : 0.5;

                this.ghostMesh.position.set(snappedX, snappedY, snappedZ);
                this.ghostMesh.visible = true;
            } else {
                 this.ghostMesh.visible = false;
            }
        } else {
            this.ghostMesh.visible = false;
        }
    }
    
    getGhostData() {
        return {
            position: this.ghostMesh.position.clone(),
            rotation: this.ghostMesh.rotation.clone(),
            assetId: this.getAssetData().id
        };
    }
}