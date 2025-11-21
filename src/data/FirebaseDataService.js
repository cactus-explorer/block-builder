// --- Actual Firebase Data Service Implementation ---
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { getFirestore, doc, setDoc, onSnapshot } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
import { getAuth, signInWithCustomToken, signInAnonymously } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { setLogLevel } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

// Global variables provided by the Canvas environment
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Hardcoded path for MVP
const DATA_PATH = `/artifacts/${appId}/users/`;
const PROJECT_ID = 'house_project_1'; 

class FirebaseDataService {
    constructor() {
        this.app = null;
        this.db = null;
        this.auth = null;
        this.userId = null;
        this.isReady = false;
    }

    async init() {
        // Check for required Firebase configuration
        if (!firebaseConfig || !firebaseConfig.projectId) {
             throw new Error("Firebase config missing or invalid.");
        }
        
        setLogLevel('Debug');
        this.app = initializeApp(firebaseConfig);
        this.db = getFirestore(this.app);
        this.auth = getAuth(this.app);
        
        // Authenticate user
        if (initialAuthToken) {
            await signInWithCustomToken(this.auth, initialAuthToken);
        } else {
            await signInAnonymously(this.auth);
        }
        this.userId = this.auth.currentUser?.uid || crypto.randomUUID();
        this.isReady = true;
        console.log(`[FIREBASE] DataService initialized. User ID: ${this.userId}`);
    }

    /**
     * Saves the current serialized house structure.
     * @param {Array<Object>} data - Array of objects representing placed furniture/walls.
     */
    async saveProject(data) {
        if (!this.isReady) return;
        try {
            const docRef = doc(this.db, DATA_PATH + this.userId, PROJECT_ID);
            await setDoc(docRef, { houseData: data });
            // console.log("[FIREBASE] Project saved successfully.");
        } catch (e) {
            console.error("[FIREBASE] Error saving document: ", e);
        }
    }

    /**
     * Subscribes to the project data for real-time loading.
     * @param {Function} callback - Function called with the loaded data array.
     * @returns {Function} Unsubscribe function.
     */
    subscribeToProject(callback) {
        if (!this.isReady) throw new Error("[FIREBASE] DataService not initialized.");
        const docRef = doc(this.db, DATA_PATH + this.userId, PROJECT_ID);
        
        return onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                callback(docSnap.data().houseData);
            } else {
                callback([]); // Return empty array if no data exists
            }
        }, (error) => {
            console.error("[FIREBASE] Firestore subscription error:", error);
        });
    }
}

export const firebaseDataService = new FirebaseDataService();