document.addEventListener('DOMContentLoaded', () => {
    const state = {
        goals: [],
    };

    const goalList = document.getElementById('goal-list');
    const addGoalInput = document.getElementById('add-goal-input');
    const addGoalBtn = document.getElementById('add-goal-btn');
    const logoutBtnSidebar = document.getElementById('logout-btn-sidebar');
    const confirmationModal = document.getElementById('confirmation-modal');
    const confirmationMessage = document.getElementById('confirmation-message');
    const confirmYes = document.getElementById('confirm-yes');
    const confirmNo = document.getElementById('confirm-no');
    
    // Edit modal elements
    const editGoalModal = document.getElementById('edit-goal-modal');
    const editGoalName = document.getElementById('edit-goal-name');
    const saveGoalEditBtn = document.getElementById('save-goal-edit');
    const cancelGoalEdit = document.getElementById('cancel-goal-edit');

    let userId = null;
    let db;
    let confirmationAction = null;
    let currentEditingGoal = null;

    const showConfirmation = (message, onConfirm) => {
        confirmationMessage.textContent = message;
        confirmationAction = onConfirm;
        confirmationModal.classList.remove('hidden');
    };

    const showEditGoalModal = (goal) => {
        currentEditingGoal = goal;
        editGoalName.value = goal.name;
        editGoalModal.classList.remove('hidden');
    };

    const hideEditGoalModal = () => {
        editGoalModal.classList.add('hidden');
        currentEditingGoal = null;
    };

    const saveState = async () => {
        if (!userId) return;
        try {
            const userDoc = await db.collection('users').doc(userId).get();
            if (userDoc.exists) {
                await db.collection('users').doc(userId).update({ goals: state.goals });
            } else {
                await db.collection('users').doc(userId).set({ goals: state.goals });
            }
        } catch (e) {
            console.error("Error saving state to Firebase:", e);
        }
    };

    const loadState = async () => {
        if (!userId) return;
        try {
            const doc = await db.collection('users').doc(userId).get();
            if (doc.exists) {
                const loadedData = doc.data();
                state.goals = loadedData.goals || [];
            }
        } catch (e) {
            console.error("Error loading state from Firebase:", e);
        }
    };

    const renderGoals = () => {
        goalList.innerHTML = '';
        if (state.goals.length === 0) {
            goalList.innerHTML = '<p style="padding: 0 1rem; opacity: 0.7;">Add a goal to get started.</p>';
            return;
        }
        state.goals.forEach(goal => {
            const goalItem = document.createElement('li');
            goalItem.className = `goal-item ${goal.completed ? 'completed' : ''}`;
            goalItem.dataset.id = goal.id;
            goalItem.innerHTML = `
                <div style="display: flex; align-items: center; gap: 0.5em; flex: 1;">
                    <span>${goal.name}</span>
                </div>
                <div class="activity-actions">
                    <button class="edit-btn edit-goal-btn" data-id="${goal.id}">✏️</button>
                    <button class="remove-btn" data-id="${goal.id}">&times;</button>
                </div>
            `;
            goalList.appendChild(goalItem);
        });
    };

    const handleGoalActions = (e) => {
        const target = e.target;
        const goalItem = target.closest('.goal-item');
        if (goalItem) {
            const goalId = goalItem.dataset.id;
            const goal = state.goals.find(g => g.id === goalId);
            if (goal) {
                if (target.classList.contains('edit-goal-btn')) {
                    e.stopPropagation();
                    showEditGoalModal(goal);
                } else if (target.classList.contains('remove-btn')) {
                    e.stopPropagation();
                    showConfirmation(`Are you sure you want to delete goal "${goal.name}"?`, () => {
                        state.goals = state.goals.filter(g => g.id !== goalId);
                        saveState();
                        renderGoals();
                    });
                } else if (!target.classList.contains('edit-btn')) {
                    // Only toggle completion if not clicking on action buttons
                    goal.completed = !goal.completed;
                    saveState();
                    renderGoals();
                }
            }
        }
    };

    const initApp = async () => {
        await loadState();
        renderGoals();
        if(logoutBtnSidebar) logoutBtnSidebar.classList.remove('hidden');
    };

    const saveGoalEdit = async () => {
        if (!currentEditingGoal) return;
        
        const newName = editGoalName.value.trim();
        if (!newName) {
            alert('Please enter a valid goal name.');
            return;
        }

        // Update goal name
        currentEditingGoal.name = newName;
        
        try {
            await saveState();
            renderGoals();
            hideEditGoalModal();
        } catch (error) {
            console.error('Error saving goal edit:', error);
            alert('Failed to save changes. Please try again.');
        }
    };

    const setupAuth = () => {
        db = firebase.firestore();
        if(logoutBtnSidebar) {
            logoutBtnSidebar.addEventListener('click', () => {
                showConfirmation('Are you sure you want to logout?', () => {
                    firebase.auth().signOut();
                });
            });
        }

        firebase.auth().onAuthStateChanged(user => {
            if (user) {
                userId = user.uid;
                initApp();
            } else {
                userId = null;
                window.location.href = 'pages/login.html';
            }
        });
    };

    const addGoal = () => {
        const name = addGoalInput.value.trim();
        if (name) {
            const newGoal = { id: `goal_${Date.now()}`, name, completed: false };
            state.goals.push(newGoal);
            addGoalInput.value = '';
            saveState();
            renderGoals();
        }
    };

    addGoalInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') addGoal();
    });
    addGoalBtn.addEventListener('click', addGoal);
    goalList.addEventListener('click', handleGoalActions);

    confirmNo.addEventListener('click', () => {
        confirmationModal.classList.add('hidden');
        confirmationAction = null;
    });

    confirmYes.addEventListener('click', () => {
        if (confirmationAction) {
            confirmationAction();
        }
        confirmationModal.classList.add('hidden');
        confirmationAction = null;
    });

    // Edit modal event listeners
    saveGoalEditBtn.addEventListener('click', saveGoalEdit);
    cancelGoalEdit.addEventListener('click', hideEditGoalModal);
    
    // Close modal when clicking outside
    editGoalModal.addEventListener('click', (e) => {
        if (e.target === editGoalModal) {
            hideEditGoalModal();
        }
    });
    
    // Handle Enter key in edit form
    editGoalName.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') saveGoalEdit();
    });

    setupAuth();
});
