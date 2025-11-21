// --- Main Entry Point ---

import { SceneManager } from './scene/SceneManager.js';

let sceneManager = null;

function main() {
    try {
        // The scene manager takes over the application lifecycle
        sceneManager = new SceneManager(document.body);
        sceneManager.animate();
    } catch (error) {
        console.error("Application failed to start:", error);
    }
}

// Start the application after all necessary modules and libraries are loaded
window.onload = function() {
    // Wait for THREE and CANNON to be available globally
    if (window.THREE && window.CANNON) {
        main();
    } else {
        console.error("THREE.js or CANNON.js is not loaded. Check script tags in index.html.");
    }
}