// Global Theme Management for BitHab
// This script provides consistent theme toggling across all pages

class ThemeManager {
    constructor() {
        this.storageKey = 'bitHabTheme';
        this.themeClass = 'dark';
        this.init();
    }

    init() {
        // Apply saved theme immediately on page load
        this.applySavedTheme();
        // Setup theme toggle listeners with proper timing
        this.setupEventListeners();
    }

    applySavedTheme() {
        const savedTheme = localStorage.getItem(this.storageKey);
        
        if (savedTheme === 'dark') {
            document.body.classList.add(this.themeClass);
        } else if (savedTheme === 'light') {
            document.body.classList.remove(this.themeClass);
        } else {
            // If no saved theme, check system preference
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                document.body.classList.add(this.themeClass);
                localStorage.setItem(this.storageKey, 'dark');
            } else {
                document.body.classList.remove(this.themeClass);
                localStorage.setItem(this.storageKey, 'light');
            }
        }
        
        // Update button icons after DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.updateThemeIcons());
        } else {
            this.updateThemeIcons();
        }
    }

    toggleTheme() {
        const isDark = document.body.classList.contains(this.themeClass);
        
        if (isDark) {
            document.body.classList.remove(this.themeClass);
            localStorage.setItem(this.storageKey, 'light');
        } else {
            document.body.classList.add(this.themeClass);
            localStorage.setItem(this.storageKey, 'dark');
        }
        
        // Update button icons
        this.updateThemeIcons();
        
        // Dispatch custom event for other scripts to listen to
        window.dispatchEvent(new CustomEvent('themeChanged', {
            detail: { isDark: !isDark }
        }));
    }

    updateThemeIcons() {
        const isDark = document.body.classList.contains(this.themeClass);
        const themeIcon = isDark ? '☀️' : '🌙';
        
        // Update all theme toggle buttons on the page
        const themeButtons = document.querySelectorAll('[id*="theme-toggle"]');
        themeButtons.forEach(button => {
            if (button) {
                button.innerHTML = themeIcon;
                button.setAttribute('aria-label', isDark ? 'Switch to light theme' : 'Switch to dark theme');
            }
        });
    }

    setupEventListeners() {
        // Use event delegation on document for maximum compatibility
        document.addEventListener('click', (e) => {
            if (e.target.id && e.target.id.includes('theme-toggle')) {
                e.preventDefault();
                e.stopPropagation();
                console.log('Theme toggle clicked via delegation:', e.target.id);
                this.toggleTheme();
            }
        });

        // Set up direct listeners when DOM is ready
        const setupDirectListeners = () => {
            const themeButtons = document.querySelectorAll('[id*="theme-toggle"]');
            console.log('Found theme buttons:', themeButtons.length);
            themeButtons.forEach(button => {
                if (button && !button.hasAttribute('data-theme-listener')) {
                    button.setAttribute('data-theme-listener', 'true');
                    button.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('Theme toggle clicked directly:', button.id);
                        this.toggleTheme();
                    });
                }
            });
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', setupDirectListeners);
        } else {
            setupDirectListeners();
        }

        // Also set up listeners after a short delay to catch any late-loading elements
        setTimeout(setupDirectListeners, 100);

        // Listen for system theme changes
        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                // Only auto-update if user hasn't manually set a preference recently
                const savedTheme = localStorage.getItem(this.storageKey);
                if (!savedTheme) {
                    if (e.matches) {
                        document.body.classList.add(this.themeClass);
                        localStorage.setItem(this.storageKey, 'dark');
                    } else {
                        document.body.classList.remove(this.themeClass);
                        localStorage.setItem(this.storageKey, 'light');
                    }
                    this.updateThemeIcons();
                }
            });
        }
    }

    getCurrentTheme() {
        return document.body.classList.contains(this.themeClass) ? 'dark' : 'light';
    }

    setTheme(theme) {
        if (theme === 'dark') {
            document.body.classList.add(this.themeClass);
            localStorage.setItem(this.storageKey, 'dark');
        } else if (theme === 'light') {
            document.body.classList.remove(this.themeClass);
            localStorage.setItem(this.storageKey, 'light');
        }
        this.updateThemeIcons();
    }
}

// Initialize theme manager as soon as the script loads
window.BitHabThemeManager = new ThemeManager();

// Global function for manual theme toggling (backward compatibility)
window.toggleTheme = () => {
    window.BitHabThemeManager.toggleTheme();
};
