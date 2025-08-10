// Universal Error Handler for BitHab
// Provides consistent error handling across all pages

class ErrorHandler {
    constructor() {
        this.errorContainer = null;
        this.init();
    }

    init() {
        // Create error container if it doesn't exist
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.createErrorContainer());
        } else {
            this.createErrorContainer();
        }

        // Handle uncaught errors
        window.addEventListener('error', (e) => {
            console.error('Uncaught error:', e.error);
            this.showError('An unexpected error occurred. Please refresh the page.');
        });

        // Handle unhandled promise rejections
        window.addEventListener('unhandledrejection', (e) => {
            console.error('Unhandled promise rejection:', e.reason);
            this.showError('An unexpected error occurred. Please refresh the page.');
        });
    }

    createErrorContainer() {
        // Check if error container already exists
        this.errorContainer = document.getElementById('global-error-container');
        
        if (!this.errorContainer) {
            this.errorContainer = document.createElement('div');
            this.errorContainer.id = 'global-error-container';
            this.errorContainer.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                max-width: 400px;
                pointer-events: none;
            `;
            document.body.appendChild(this.errorContainer);
        }
    }

    showError(message, type = 'error', duration = 5000) {
        if (!this.errorContainer) {
            this.createErrorContainer();
        }

        const errorElement = document.createElement('div');
        errorElement.style.cssText = `
            background: ${type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#10b981'};
            color: white;
            padding: 1rem;
            border-radius: 8px;
            margin-bottom: 0.5rem;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            transform: translateX(100%);
            transition: transform 0.3s ease;
            pointer-events: auto;
            cursor: pointer;
            max-width: 100%;
            word-wrap: break-word;
        `;
        
        errorElement.textContent = message;
        
        // Click to dismiss
        errorElement.addEventListener('click', () => {
            this.hideError(errorElement);
        });
        
        this.errorContainer.appendChild(errorElement);
        
        // Animate in
        requestAnimationFrame(() => {
            errorElement.style.transform = 'translateX(0)';
        });
        
        // Auto-hide after duration
        if (duration > 0) {
            setTimeout(() => {
                this.hideError(errorElement);
            }, duration);
        }
        
        return errorElement;
    }

    hideError(errorElement) {
        if (errorElement && errorElement.parentNode) {
            errorElement.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (errorElement.parentNode) {
                    errorElement.parentNode.removeChild(errorElement);
                }
            }, 300);
        }
    }

    showSuccess(message, duration = 3000) {
        return this.showError(message, 'success', duration);
    }

    showWarning(message, duration = 4000) {
        return this.showError(message, 'warning', duration);
    }

    // Firebase error code to user-friendly message mapping
    getFirebaseErrorMessage(error) {
        switch (error.code) {
            case 'auth/invalid-email':
                return 'Please enter a valid email address.';
            case 'auth/user-disabled':
                return 'This account has been disabled.';
            case 'auth/user-not-found':
                return 'No account found with this email address.';
            case 'auth/wrong-password':
                return 'Incorrect password. Please try again.';
            case 'auth/invalid-login-credentials':
                return 'Invalid email or password. Please check your credentials and try again.';
            case 'auth/too-many-requests':
                return 'Too many failed attempts. Please try again later.';
            case 'auth/email-already-in-use':
                return 'An account with this email already exists.';
            case 'auth/weak-password':
                return 'Password should be at least 6 characters long.';
            case 'auth/operation-not-allowed':
                return 'Email registration is currently disabled.';
            case 'permission-denied':
                return 'You do not have permission to perform this action.';
            case 'not-found':
                return 'The requested data was not found.';
            case 'already-exists':
                return 'The data already exists.';
            case 'failed-precondition':
                return 'The operation failed due to a precondition.';
            case 'aborted':
                return 'The operation was aborted.';
            case 'out-of-range':
                return 'The operation was outside the valid range.';
            case 'unimplemented':
                return 'This operation is not implemented.';
            case 'internal':
                return 'An internal error occurred.';
            case 'unavailable':
                return 'The service is currently unavailable.';
            case 'data-loss':
                return 'Data loss occurred.';
            case 'unauthenticated':
                return 'You must be logged in to perform this action.';
            default:
                return error.message || 'An unexpected error occurred.';
        }
    }

    // Handle Firebase errors specifically
    handleFirebaseError(error, customMessage = null) {
        const message = customMessage || this.getFirebaseErrorMessage(error);
        console.error('Firebase error:', error);
        this.showError(message);
    }

    // Handle network errors
    handleNetworkError() {
        this.showError('Network error. Please check your connection and try again.');
    }
}

// Create global instance
window.errorHandler = new ErrorHandler();

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ErrorHandler;
}
