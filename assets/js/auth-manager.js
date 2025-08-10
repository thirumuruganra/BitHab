// Universal Authentication Manager for BitHab
// Handles authentication state across all pages

class AuthManager {
    constructor() {
        this.user = null;
        this.callbacks = new Set();
        this.initialized = false;
        this.init();
    }

    init() {
        // Wait for Firebase to be loaded
        if (typeof firebase === 'undefined') {
            console.error('Firebase not loaded');
            return;
        }

        firebase.auth().onAuthStateChanged((user) => {
            this.user = user;
            this.initialized = true;
            
            // Notify all callbacks
            this.callbacks.forEach(callback => {
                try {
                    callback(user);
                } catch (error) {
                    console.error('Auth callback error:', error);
                }
            });

            // Handle page redirects
            this.handlePageRedirects(user);
        });
    }

    handlePageRedirects(user) {
        const currentPath = window.location.pathname;
        const isAuthPage = currentPath.includes('login.html') || currentPath.includes('register.html');
        
        if (!user && !isAuthPage) {
            // Not authenticated and not on auth page - redirect to login
            const loginPath = currentPath.includes('/pages/') ? 'login.html' : 'pages/login.html';
            window.location.href = loginPath;
        } else if (user && isAuthPage) {
            // Authenticated but on auth page - redirect to dashboard
            const homePath = currentPath.includes('/pages/') ? '../index.html' : 'index.html';
            window.location.href = homePath;
        }
    }

    // Subscribe to auth state changes
    onAuthStateChange(callback) {
        this.callbacks.add(callback);
        
        // If already initialized, call callback immediately
        if (this.initialized) {
            callback(this.user);
        }
        
        // Return unsubscribe function
        return () => {
            this.callbacks.delete(callback);
        };
    }

    // Get current user
    getCurrentUser() {
        return this.user;
    }

    // Check if user is authenticated
    isAuthenticated() {
        return !!this.user;
    }

    // Sign out
    async signOut() {
        try {
            await firebase.auth().signOut();
            const loginPath = window.location.pathname.includes('/pages/') ? 'login.html' : 'pages/login.html';
            window.location.href = loginPath;
        } catch (error) {
            console.error('Sign out error:', error);
            throw error;
        }
    }

    // Get user ID
    getUserId() {
        return this.user ? this.user.uid : null;
    }

    // Wait for authentication to be initialized
    waitForAuth() {
        return new Promise((resolve) => {
            if (this.initialized) {
                resolve(this.user);
            } else {
                const unsubscribe = this.onAuthStateChange((user) => {
                    unsubscribe();
                    resolve(user);
                });
            }
        });
    }
}

// Create global instance
window.authManager = new AuthManager();

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuthManager;
}
