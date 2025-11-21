// --- MOCK Data Service: Uses localStorage for persistence ---

const MOCK_STORAGE_KEY = 'mock_house_project_1';

class MockDataService {
    constructor() {
        this.isReady = false;
        this.data = [];
        this.subscribers = [];
        this.init();
    }

    async init() {
        // Simulate Firebase initialization time
        await new Promise(resolve => setTimeout(resolve, 50)); 
        
        // Load data from localStorage if available
        const storedData = localStorage.getItem(MOCK_STORAGE_KEY);
        if (storedData) {
            try {
                this.data = JSON.parse(storedData);
            } catch (e) {
                console.error("MockDataService: Failed to parse localStorage data, starting fresh.", e);
                this.data = [];
            }
        }
        
        this.isReady = true;
        console.warn(`[MOCK] DataService initialized (using localStorage). User ID: mock-user-${crypto.randomUUID().substring(0, 8)}`);
        
        // Notify subscribers immediately upon loading
        this.notifySubscribers();
    }

    notifySubscribers() {
        this.subscribers.forEach(callback => callback(this.data));
    }

    /**
     * Subscribes to project data changes (Mock implementation)
     * @param {Function} callback - Function called with the loaded data array.
     * @returns {Function} Unsubscribe function.
     */
    subscribeToProject(callback) {
        if (!this.isReady) {
            // If not ready, queue the subscriber and rely on init to call notifySubscribers
            this.subscribers.push(callback);
        } else {
            // If already ready, notify immediately with current data
            callback(this.data);
        }
        
        // Return unsubscribe function
        const index = this.subscribers.length - 1;
        return () => {
            if (index > -1) {
                this.subscribers.splice(index, 1);
            }
        };
    }

    /**
     * Saves the current serialized house structure (Mock implementation)
     * @param {Array<Object>} data - Array of objects representing placed furniture/walls.
     */
    async saveProject(data) {
        if (!this.isReady) return;
        
        this.data = data;
        
        // Persist to localStorage
        localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(data));
        
        // Notify subscribers (simulates onSnapshot real-time update)
        this.notifySubscribers();

        console.log(`[MOCK] Project saved successfully. Total items: ${data.length}`);
    }
}

export const mockDataService = new MockDataService();