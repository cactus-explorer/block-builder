// --- Data Service Selector: Determines whether to use MOCK or FIREBASE ---

// Try to parse firebase config from the global environment variable
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};

let useFirebase = false;
try {
    // Determine if we have a valid projectId set by checking the parsed config
    // We check for length > 5 as a heuristic to ensure it's not an empty placeholder string.
    if (firebaseConfig && firebaseConfig.projectId && firebaseConfig.projectId.length > 5) {
        useFirebase = true;
    }
} catch (e) {
    // Ignore parsing errors, assume no valid config
    useFirebase = false;
}

let dataServiceInstance; // Declare the variable at the top level

if (useFirebase) {
    // If config is valid, use the real implementation
    console.log("Using live Firebase Data Service.");
    // Dynamically import and assign the service instance
    const { firebaseDataService } = await import('./FirebaseDataService.js');
    dataServiceInstance = firebaseDataService;
} else {
    // If config is missing or invalid, use the mock implementation
    console.warn("Using MOCK Data Service (Firebase config missing or invalid).");
    // Dynamically import and assign the service instance
    const { mockDataService } = await import('./MockDataService.js');
    dataServiceInstance = mockDataService;
}

// Perform the final export at the top level of the module
export const dataService = dataServiceInstance;