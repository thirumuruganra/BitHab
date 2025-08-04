// Notes page functionality
class NotesManager {
    constructor() {
        this.db = firebase.firestore();
        this.auth = firebase.auth();
        this.state = {
            notes: {},
            currentFilter: 'all'
        };
        this.editingNoteDate = null;
        this.init();
    }

    init() {
        this.auth.onAuthStateChanged(user => {
            if (user) {
                this.loadNotes();
                this.setupEventListeners();
            } else {
                window.location.href = '../pages/login.html';
            }
        });
    }

    setupEventListeners() {
        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.setFilter(e.target.dataset.filter);
            });
        });

        // Add new note button
        document.getElementById('add-new-note-btn').addEventListener('click', () => {
            this.openAddNoteModal();
        });

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
        document.getElementById('close-edit-modal').addEventListener('click', () => {
            this.closeEditModal();
        });

        document.getElementById('save-note-btn').addEventListener('click', () => {
            this.saveNote();
        });

        document.getElementById('delete-note-btn').addEventListener('click', () => {
            this.confirmDeleteNote();
        });

        // Close modal when clicking outside
        document.getElementById('edit-note-modal').addEventListener('click', (e) => {
            if (e.target.id === 'edit-note-modal') {
                this.closeEditModal();
            }
        });

        // Logout functionality
        document.getElementById('logout-btn-sidebar').addEventListener('click', () => {
            this.auth.signOut().then(() => {
                window.location.href = '../pages/login.html';
            });
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeEditModal();
            }
            // Ctrl/Cmd + Enter to save
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                if (!document.getElementById('edit-note-modal').classList.contains('hidden')) {
                    this.saveNote();
                }
            }
        });
    }

    async loadNotes() {
        try {
            const user = this.auth.currentUser;
            if (!user) return;

            this.showLoading(true);
            
            const notesSnapshot = await this.db.collection('users').doc(user.uid).collection('notes').get();
            this.state.notes = {};
            
            notesSnapshot.forEach(doc => {
                this.state.notes[doc.id] = doc.data().note;
            });

            this.updateStats();
            this.renderNotes();
            this.showLoading(false);
        } catch (error) {
            console.error('Error loading notes:', error);
            this.showLoading(false);
        }
    }

    updateStats() {
        const notes = Object.values(this.state.notes);
        const totalNotes = notes.length;
        
        // Calculate notes from current month
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        const thisMonthNotes = Object.keys(this.state.notes).filter(dateStr => {
            const noteDate = new Date(dateStr);
            return noteDate.getFullYear() === currentYear && noteDate.getMonth() === currentMonth;
        }).length;

        document.getElementById('total-notes').textContent = totalNotes;
        document.getElementById('recent-notes').textContent = thisMonthNotes;
    }

    setFilter(filter) {
        this.state.currentFilter = filter;
        
        // Update active filter button
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });

        this.renderNotes();
    }

    renderNotes() {
        const notesList = document.getElementById('notes-list');
        const emptyState = document.getElementById('empty-state');
        
        const filteredNotes = this.getFilteredNotes();
        
        if (filteredNotes.length === 0) {
            // Clear existing content but preserve empty state
            notesList.innerHTML = '';
            if (emptyState) {
                notesList.appendChild(emptyState);
                emptyState.classList.remove('hidden');
            }
            return;
        }

        // Hide empty state if it exists
        if (emptyState) {
            emptyState.classList.add('hidden');
        }

        // Sort notes by date (newest first)
        filteredNotes.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Create notes HTML
        const notesHTML = filteredNotes.map(note => this.createNoteCard(note)).join('');
        
        // Set innerHTML but preserve empty state
        if (emptyState) {
            notesList.innerHTML = notesHTML;
            notesList.appendChild(emptyState);
        } else {
            notesList.innerHTML = notesHTML;
        }

        // Add event listeners to action buttons and note cards
        notesList.querySelectorAll('.edit-note-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openEditModal(btn.dataset.date);
            });
        });

        // Make note cards clickable for editing
        notesList.querySelectorAll('.note-card').forEach(card => {
            card.addEventListener('click', () => {
                const editBtn = card.querySelector('.edit-note-btn');
                if (editBtn) {
                    this.openEditModal(editBtn.dataset.date);
                }
            });
        });
    }

    getFilteredNotes() {
        const notes = Object.entries(this.state.notes);
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

    createNoteCard(note) {
        const formattedDate = this.formatDate(note.date);
        const relativeDate = this.getRelativeDate(note.date);
        const wordCount = note.text.trim().split(/\s+/).length;
        
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
                    <p class="note-text">${this.escapeHtml(note.text)}</p>
                    <div class="note-meta">
                        <span class="note-length">${wordCount} words</span>
                        <span class="note-relative-date">${relativeDate}</span>
                    </div>
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

    openAddNoteModal() {
        // Set to today's date by default
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        
        this.editingNoteDate = null; // Clear editing state to indicate this is a new note
        
        document.getElementById('edit-note-date').value = todayStr;
        document.getElementById('edit-note-text').value = '';
        document.getElementById('edit-modal-title').textContent = 'Add New Note';
        
        // Hide delete button for new notes
        document.getElementById('delete-note-btn').classList.add('hidden');
        
        document.getElementById('edit-note-modal').classList.remove('hidden');
        document.getElementById('edit-note-text').focus();
    }

    openEditModal(dateStr) {
        this.editingNoteDate = dateStr;
        const note = this.state.notes[dateStr] || '';
        
        document.getElementById('edit-note-date').value = dateStr;
        document.getElementById('edit-note-text').value = note;
        document.getElementById('edit-modal-title').textContent = `Edit Note - ${this.formatDate(dateStr)}`;
        
        // Show delete button for existing notes
        document.getElementById('delete-note-btn').classList.remove('hidden');
        
        document.getElementById('edit-note-modal').classList.remove('hidden');
        document.getElementById('edit-note-text').focus();
    }

    closeEditModal() {
        document.getElementById('edit-note-modal').classList.add('hidden');
        this.editingNoteDate = null;
    }

    async saveNote() {
        // Get the date from the input field (for both new and existing notes)
        const dateStr = document.getElementById('edit-note-date').value;
        const noteText = document.getElementById('edit-note-text').value.trim();
        
        if (!dateStr) {
            alert('Please select a date.');
            return;
        }
        
        try {
            this.showLoading(true);
            
            const user = this.auth.currentUser;
            if (!user) throw new Error('User not authenticated');

            if (noteText) {
                // Save note
                await this.db.collection('users').doc(user.uid).collection('notes').doc(dateStr).set({
                    note: noteText
                });
                this.state.notes[dateStr] = noteText;
            } else {
                // Delete note if empty (only for existing notes)
                if (this.editingNoteDate) {
                    await this.db.collection('users').doc(user.uid).collection('notes').doc(dateStr).delete();
                    delete this.state.notes[dateStr];
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

    confirmDeleteNote() {
        const modal = document.getElementById('confirmation-modal');
        const message = document.getElementById('confirmation-message');
        
        message.textContent = `Are you sure you want to delete the note for ${this.formatDate(this.editingNoteDate)}?`;
        modal.classList.remove('hidden');

        const handleConfirm = async () => {
            try {
                this.showLoading(true);
                
                const user = this.auth.currentUser;
                if (!user) throw new Error('User not authenticated');

                await this.db.collection('users').doc(user.uid).collection('notes').doc(this.editingNoteDate).delete();
                delete this.state.notes[this.editingNoteDate];

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
        if (show) {
            loadingIndicator.classList.remove('hidden');
        } else {
            loadingIndicator.classList.add('hidden');
        }
    }
}

// Initialize the notes manager when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new NotesManager();
});
