// Notes page functionality
class NotesManager {
    constructor() {
        this.db = firebase.firestore();
        this.auth = firebase.auth();
        this.state = {
            dailyNotes: {},
            generalNotes: {},
            currentType: 'daily',
            currentFilter: 'all',
            generalFilter: 'all'
        };
        this.editingNoteId = null;
        this.editingNoteType = null;
        this.init();
    }

    init() {
        // Wait for DOM to be ready before setting up auth listener
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.setupAuth();
            });
        } else {
            this.setupAuth();
        }
    }

    setupAuth() {
        authManager.onAuthStateChange(user => {
            if (user) {
                this.loadAllNotes();
                this.setupEventListeners();
            } else {
                // Auth manager will handle redirect
            }
        });
    }

    setupEventListeners() {
        // Note type toggle
        document.querySelectorAll('.note-type-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchNoteType(e.target.dataset.type);
            });
        });

        // Filter buttons for daily notes
        document.querySelectorAll('.notes-filter .filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.setFilter(e.target.dataset.filter);
            });
        });

        // Filter buttons for general notes
        document.querySelectorAll('.general-notes-filter .filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.setGeneralFilter(e.target.dataset.filter);
            });
        });

        // Add new note buttons
        const addDailyBtn = document.getElementById('add-new-note-btn');
        if (addDailyBtn) {
            addDailyBtn.addEventListener('click', () => {
                this.openAddNoteModal('daily');
            });
        }

        const addGeneralBtn = document.getElementById('add-new-general-note-btn');
        if (addGeneralBtn) {
            addGeneralBtn.addEventListener('click', () => {
                this.openAddNoteModal('general');
            });
        }

        // Date shortcuts
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('date-shortcut')) {
                const days = parseInt(e.target.dataset.days);
                const date = new Date();
                date.setDate(date.getDate() + days);
                const dateStr = date.toISOString().split('T')[0];
                document.getElementById('edit-note-date').value = dateStr;
            }
        });

        // Edit modal events
        const closeModalBtn = document.getElementById('close-edit-modal');
        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', () => {
                this.closeEditModal();
            });
        }

        const saveBtn = document.getElementById('save-note-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.saveNote();
            });
        }

        const deleteBtn = document.getElementById('delete-note-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                this.confirmDeleteNote();
            });
        }

        // Close modal when clicking outside
        const modal = document.getElementById('edit-note-modal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target.id === 'edit-note-modal') {
                    this.closeEditModal();
                }
            });
        }

        // Logout functionality
        const logoutBtn = document.getElementById('logout-btn-sidebar');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                this.auth.signOut().then(() => {
                    window.location.href = '../pages/login.html';
                });
            });
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeEditModal();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                if (!document.getElementById('edit-note-modal').classList.contains('hidden')) {
                    this.saveNote();
                }
            }
        });
        
        // Setup note event delegation for better performance
        this.setupNoteEventDelegation();
    }

    setupNoteEventDelegation() {
        // Remove any existing listeners to prevent duplicates
        const dailyNotesList = document.getElementById('notes-list');
        const generalNotesList = document.getElementById('general-notes-list');
        
        // Use event delegation for daily notes
        if (dailyNotesList) {
            // Remove existing delegated listener if any
            if (this.handleDailyNoteClick) {
                dailyNotesList.removeEventListener('click', this.handleDailyNoteClick);
            }
            // Add new delegated listener
            this.handleDailyNoteClick = (e) => {
                const editBtn = e.target.closest('.edit-note-btn');
                const noteCard = e.target.closest('.note-card');
                
                if (editBtn) {
                    e.stopPropagation();
                    this.openEditModal(editBtn.dataset.date, 'daily');
                } else if (noteCard) {
                    const cardEditBtn = noteCard.querySelector('.edit-note-btn');
                    if (cardEditBtn) {
                        this.openEditModal(cardEditBtn.dataset.date, 'daily');
                    }
                }
            };
            dailyNotesList.addEventListener('click', this.handleDailyNoteClick);
        }
        
        // Use event delegation for general notes
        if (generalNotesList) {
            // Remove existing delegated listener if any
            if (this.handleGeneralNoteClick) {
                generalNotesList.removeEventListener('click', this.handleGeneralNoteClick);
            }
            // Add new delegated listener
            this.handleGeneralNoteClick = (e) => {
                const editBtn = e.target.closest('.edit-general-note-btn');
                const noteCard = e.target.closest('.general-note-card');
                
                if (editBtn) {
                    e.stopPropagation();
                    this.openEditModal(editBtn.dataset.id, 'general');
                } else if (noteCard) {
                    const cardEditBtn = noteCard.querySelector('.edit-general-note-btn');
                    if (cardEditBtn) {
                        this.openEditModal(cardEditBtn.dataset.id, 'general');
                    }
                }
            };
            generalNotesList.addEventListener('click', this.handleGeneralNoteClick);
        }
    }

    switchNoteType(type) {
        this.state.currentType = type;
        
        // Update active button
        document.querySelectorAll('.note-type-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === type);
        });

        // Show/hide sections
        if (type === 'daily') {
            document.getElementById('daily-notes-section').classList.remove('hidden');
            document.getElementById('general-notes-section').classList.add('hidden');
        } else {
            document.getElementById('daily-notes-section').classList.add('hidden');
            document.getElementById('general-notes-section').classList.remove('hidden');
        }

        this.renderNotes();
    }

    async loadAllNotes() {
        try {
            const user = this.auth.currentUser;
            if (!user) return;

            this.showLoading(true);
            
            // Load both collections in parallel for better performance
            const [dailyNotesSnapshot, generalNotesSnapshot] = await Promise.all([
                this.db.collection('users').doc(user.uid).collection('notes').get(),
                this.db.collection('users').doc(user.uid).collection('generalNotes').get()
            ]);
            
            // Process daily notes
            this.state.dailyNotes = {};
            dailyNotesSnapshot.forEach(doc => {
                this.state.dailyNotes[doc.id] = doc.data().note;
            });

            // Process general notes
            this.state.generalNotes = {};
            generalNotesSnapshot.forEach(doc => {
                this.state.generalNotes[doc.id] = doc.data();
            });

            this.updateStats();
            this.renderNotes();
            this.showLoading(false);
        } catch (error) {
            console.error('Error loading notes:', error);
            this.showLoading(false);
            // Use global error handler
            if (window.errorHandler) {
                errorHandler.handleFirebaseError(error, 'Failed to load notes. Please refresh the page.');
            } else {
                this.showErrorMessage('Failed to load notes. Please refresh the page.');
            }
        }
    }

    updateStats() {
        const dailyNotes = Object.values(this.state.dailyNotes);
        const generalNotes = Object.values(this.state.generalNotes);
        const totalNotes = dailyNotes.length;
        
        // Calculate notes from current month
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        const thisMonthNotes = Object.keys(this.state.dailyNotes).filter(dateStr => {
            const noteDate = new Date(dateStr);
            return noteDate.getFullYear() === currentYear && noteDate.getMonth() === currentMonth;
        }).length;

        document.getElementById('total-notes').textContent = totalNotes;
        document.getElementById('recent-notes').textContent = thisMonthNotes;
        document.getElementById('general-notes-count').textContent = generalNotes.length;
    }

    setFilter(filter) {
        this.state.currentFilter = filter;
        
        // Update active filter button
        document.querySelectorAll('.notes-filter .filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });

        this.renderNotes();
    }

    setGeneralFilter(filter) {
        this.state.generalFilter = filter;
        
        // Update active filter button
        document.querySelectorAll('.general-notes-filter .filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });

        this.renderNotes();
    }

    renderNotes() {
        if (this.state.currentType === 'daily') {
            this.renderDailyNotes();
        } else {
            this.renderGeneralNotes();
        }
    }

    renderDailyNotes() {
        const notesList = document.getElementById('notes-list');
        const emptyState = document.getElementById('empty-state');
        
        if (!notesList) {
            console.error('Notes list element not found');
            return;
        }
        
        const filteredNotes = this.getFilteredDailyNotes();
        
        if (filteredNotes.length === 0) {
            notesList.innerHTML = '';
            if (emptyState) {
                emptyState.classList.remove('hidden');
                notesList.appendChild(emptyState);
            }
            return;
        }

        if (emptyState) {
            emptyState.classList.add('hidden');
        }

        // Sort notes by date (newest first)
        filteredNotes.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Create notes HTML
        const notesHTML = filteredNotes.map(note => this.createDailyNoteCard(note)).join('');
        notesList.innerHTML = notesHTML;
        
        // Add empty state back to DOM if it exists
        if (emptyState && emptyState.parentNode !== notesList) {
            notesList.appendChild(emptyState);
        }

        // Use event delegation instead of adding individual listeners
        this.setupNoteEventDelegation();
    }

    renderGeneralNotes() {
        const notesList = document.getElementById('general-notes-list');
        const emptyState = document.getElementById('general-empty-state');
        
        if (!notesList) {
            console.error('General notes list element not found');
            return;
        }
        
        const filteredNotes = this.getFilteredGeneralNotes();
        
        if (filteredNotes.length === 0) {
            notesList.innerHTML = '';
            if (emptyState) {
                emptyState.classList.remove('hidden');
                notesList.appendChild(emptyState);
            }
            return;
        }

        if (emptyState) {
            emptyState.classList.add('hidden');
        }

        // Sort notes by creation date (newest first)
        filteredNotes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // Create notes HTML
        const notesHTML = filteredNotes.map(note => this.createGeneralNoteCard(note)).join('');
        notesList.innerHTML = notesHTML;
        
        // Add empty state back to DOM if it exists
        if (emptyState && emptyState.parentNode !== notesList) {
            notesList.appendChild(emptyState);
        }

        // Use event delegation instead of adding individual listeners
        this.setupNoteEventDelegation();
    }

    getFilteredDailyNotes() {
        const notes = Object.entries(this.state.dailyNotes);
        const now = new Date();
        
        return notes.map(([date, text]) => ({ date, text })).filter(note => {
            if (this.state.currentFilter === 'all') return true;
            
            const noteDate = new Date(note.date);
            const daysDiff = Math.floor((now - noteDate) / (1000 * 60 * 60 * 24));
            
            if (this.state.currentFilter === 'recent') {
                return daysDiff <= 30;
            } else if (this.state.currentFilter === 'older') {
                return daysDiff > 30;
            }
            
            return true;
        });
    }

    getFilteredGeneralNotes() {
        const notes = Object.entries(this.state.generalNotes);
        const now = new Date();
        
        return notes.map(([id, data]) => ({ id, ...data })).filter(note => {
            if (this.state.generalFilter === 'all') return true;
            
            const noteDate = new Date(note.createdAt);
            const daysDiff = Math.floor((now - noteDate) / (1000 * 60 * 60 * 24));
            
            if (this.state.generalFilter === 'recent') {
                return daysDiff <= 30;
            }
            
            return true;
        });
    }

    createDailyNoteCard(note) {
        const formattedDate = this.formatDate(note.date);
        const preview = note.text.length > 120 ? note.text.substring(0, 120) + '...' : note.text;
        
        return `
            <div class="note-card">
                <div class="note-header">
                    <div class="note-date">
                        📅 ${formattedDate}
                    </div>
                    <div class="note-actions">
                        <button class="note-action-btn edit-note-btn" data-date="${note.date}" title="Edit note">
                            ✏️
                        </button>
                    </div>
                </div>
                <div class="note-content">
                    <p class="note-text">${this.escapeHtml(preview)}</p>
                </div>
            </div>
        `;
    }

    createGeneralNoteCard(note) {
        const title = note.title || 'Untitled Note';
        const preview = note.content.length > 150 ? note.content.substring(0, 150) + '...' : note.content;
        
        return `
            <div class="general-note-card">
                <div class="general-note-header">
                    <h3 class="general-note-title">${this.escapeHtml(title)}</h3>
                    <div class="note-actions">
                        <button class="note-action-btn edit-general-note-btn" data-id="${note.id}" title="Edit note">
                            ✏️
                        </button>
                    </div>
                </div>
                <div class="general-note-content">
                    <p class="general-note-text">${this.escapeHtml(preview)}</p>
                </div>
            </div>
        `;
    }

    formatDate(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    getRelativeDate(dateStr) {
        const date = new Date(dateStr);
        const now = new Date();
        const diffTime = now - date;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
        if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
        return `${Math.floor(diffDays / 365)} years ago`;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    openAddNoteModal(type) {
        this.editingNoteId = null;
        this.editingNoteType = type;
        
        // Remove editing class for new notes
        document.getElementById('edit-note-modal').classList.remove('editing-existing-note');
        
        // Show/hide appropriate fields
        if (type === 'daily') {
            document.getElementById('daily-note-fields').classList.remove('hidden');
            document.getElementById('general-note-fields').classList.add('hidden');
            
            // Set to today's date by default
            const today = new Date();
            const todayStr = today.toISOString().split('T')[0];
            document.getElementById('edit-note-date').value = todayStr;
            
            document.getElementById('edit-modal-title').textContent = 'Add Daily Note';
        } else {
            document.getElementById('daily-note-fields').classList.add('hidden');
            document.getElementById('general-note-fields').classList.remove('hidden');
            
            document.getElementById('general-note-title').value = '';
            document.getElementById('edit-modal-title').textContent = 'Add General Note';
        }
        
        document.getElementById('edit-note-text').value = '';
        
        // Hide delete button for new notes
        document.getElementById('delete-note-btn').classList.add('hidden');
        
        // Show modal with animation
        const modal = document.getElementById('edit-note-modal');
        modal.classList.remove('hidden');
        
        // Trigger animation after a brief delay
        setTimeout(() => {
            modal.style.opacity = '1';
            modal.style.visibility = 'visible';
            modal.style.transform = 'scale(1)';
        }, 10);
        
        // Focus appropriate field
        setTimeout(() => {
            if (type === 'general') {
                document.getElementById('general-note-title').focus();
            } else {
                document.getElementById('edit-note-text').focus();
            }
        }, 150);
    }

    openEditModal(id, type) {
        this.editingNoteId = id;
        this.editingNoteType = type;
        
        if (type === 'daily') {
            document.getElementById('daily-note-fields').classList.remove('hidden');
            document.getElementById('general-note-fields').classList.add('hidden');
            
            const note = this.state.dailyNotes[id] || '';
            document.getElementById('edit-note-date').value = id;
            document.getElementById('edit-note-text').value = note;
            document.getElementById('edit-modal-title').textContent = `Edit Daily Note - ${this.formatDate(id)}`;
            
            // Hide date input for existing notes
            document.getElementById('edit-note-modal').classList.add('editing-existing-note');
        } else {
            document.getElementById('daily-note-fields').classList.add('hidden');
            document.getElementById('general-note-fields').classList.remove('hidden');
            
            const note = this.state.generalNotes[id];
            document.getElementById('general-note-title').value = note.title || '';
            document.getElementById('edit-note-text').value = note.content || '';
            document.getElementById('edit-modal-title').textContent = 'Edit General Note';
            
            // Remove the class for general notes
            document.getElementById('edit-note-modal').classList.remove('editing-existing-note');
        }
        
        // Show delete button for existing notes
        document.getElementById('delete-note-btn').classList.remove('hidden');
        
        // Show modal with animation
        const modal = document.getElementById('edit-note-modal');
        modal.classList.remove('hidden');
        
        // Trigger animation after a brief delay
        setTimeout(() => {
            modal.style.opacity = '1';
            modal.style.visibility = 'visible';
            modal.style.transform = 'scale(1)';
        }, 10);
        
        // Focus text area
        setTimeout(() => {
            document.getElementById('edit-note-text').focus();
        }, 150);
    }

    closeEditModal() {
        const modal = document.getElementById('edit-note-modal');
        
        // Animate out
        modal.style.opacity = '0';
        modal.style.visibility = 'hidden';
        modal.style.transform = 'scale(0.95)';
        
        // Hide modal after animation
        setTimeout(() => {
            modal.classList.add('hidden');
            this.editingNoteId = null;
            this.editingNoteType = null;
        }, 300);
    }

    async saveNote() {
        const noteText = document.getElementById('edit-note-text').value.trim();
        
        if (!noteText) {
            alert('Please enter some content for the note.');
            return;
        }
        
        try {
            this.showLoading(true);
            
            const user = this.auth.currentUser;
            if (!user) throw new Error('User not authenticated');

            if (this.editingNoteType === 'daily') {
                const dateStr = document.getElementById('edit-note-date').value;
                if (!dateStr) {
                    alert('Please select a date.');
                    return;
                }

                await this.db.collection('users').doc(user.uid).collection('notes').doc(dateStr).set({
                    note: noteText
                });
                this.state.dailyNotes[dateStr] = noteText;
            } else {
                let title = document.getElementById('general-note-title').value.trim();
                
                // Auto-generate title if not provided
                if (!title) {
                    title = this.generateNoteTitle(noteText);
                }
                
                if (this.editingNoteId) {
                    // Update existing general note
                    await this.db.collection('users').doc(user.uid).collection('generalNotes').doc(this.editingNoteId).update({
                        title: title,
                        content: noteText,
                        updatedAt: new Date().toISOString()
                    });
                    this.state.generalNotes[this.editingNoteId] = {
                        ...this.state.generalNotes[this.editingNoteId],
                        title: title,
                        content: noteText,
                        updatedAt: new Date().toISOString()
                    };
                } else {
                    // Create new general note
                    const noteRef = await this.db.collection('users').doc(user.uid).collection('generalNotes').add({
                        title: title,
                        content: noteText,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    });
                    this.state.generalNotes[noteRef.id] = {
                        id: noteRef.id,
                        title: title,
                        content: noteText,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    };
                }
            }

            this.updateStats();
            this.renderNotes();
            this.closeEditModal();
            this.showLoading(false);
            
        } catch (error) {
            console.error('Error saving note:', error);
            alert('Error saving note. Please try again.');
            this.showLoading(false);
        }
    }

    generateNoteTitle(content) {
        // Extract first line as title, or first 30 characters
        const firstLine = content.split('\n')[0].trim();
        if (firstLine.length > 0) {
            return firstLine.length > 30 ? firstLine.substring(0, 30) + '...' : firstLine;
        }
        
        // If no good first line, use first 30 characters
        const preview = content.substring(0, 30).trim();
        return preview + (content.length > 30 ? '...' : '');
    }

    confirmDeleteNote() {
        const modal = document.getElementById('confirmation-modal');
        const message = document.getElementById('confirmation-message');
        
        if (this.editingNoteType === 'daily') {
            message.textContent = `Are you sure you want to delete the note for ${this.formatDate(this.editingNoteId)}?`;
        } else {
            const noteTitle = this.state.generalNotes[this.editingNoteId]?.title || 'this note';
            message.textContent = `Are you sure you want to delete "${noteTitle}"?`;
        }
        
        modal.classList.remove('hidden');

        const handleConfirm = async () => {
            try {
                this.showLoading(true);
                
                const user = this.auth.currentUser;
                if (!user) throw new Error('User not authenticated');

                if (this.editingNoteType === 'daily') {
                    await this.db.collection('users').doc(user.uid).collection('notes').doc(this.editingNoteId).delete();
                    delete this.state.dailyNotes[this.editingNoteId];
                } else {
                    await this.db.collection('users').doc(user.uid).collection('generalNotes').doc(this.editingNoteId).delete();
                    delete this.state.generalNotes[this.editingNoteId];
                }

                this.updateStats();
                this.renderNotes();
                this.closeEditModal();
                modal.classList.add('hidden');
                this.showLoading(false);
                
            } catch (error) {
                console.error('Error deleting note:', error);
                alert('Error deleting note. Please try again.');
                this.showLoading(false);
            }
            
            // Clean up event listeners
            document.getElementById('confirm-yes').removeEventListener('click', handleConfirm);
            document.getElementById('confirm-no').removeEventListener('click', handleCancel);
        };

        const handleCancel = () => {
            modal.classList.add('hidden');
            document.getElementById('confirm-yes').removeEventListener('click', handleConfirm);
            document.getElementById('confirm-no').removeEventListener('click', handleCancel);
        };

        document.getElementById('confirm-yes').addEventListener('click', handleConfirm);
        document.getElementById('confirm-no').addEventListener('click', handleCancel);
    }

    showLoading(show) {
        const loadingIndicator = document.getElementById('loading-indicator');
        if (loadingIndicator) {
            if (show) {
                loadingIndicator.classList.remove('hidden');
            } else {
                loadingIndicator.classList.add('hidden');
            }
        }
    }

    showErrorMessage(message) {
        // Create or update error message element
        let errorElement = document.getElementById('error-message');
        if (!errorElement) {
            errorElement = document.createElement('div');
            errorElement.id = 'error-message';
            errorElement.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #ef4444;
                color: white;
                padding: 1rem;
                border-radius: 8px;
                z-index: 1001;
                max-width: 300px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            `;
            document.body.appendChild(errorElement);
        }
        
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            if (errorElement && errorElement.parentNode) {
                errorElement.style.display = 'none';
            }
        }, 5000);
    }
}

// Initialize the notes manager when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new NotesManager();
});
