document.addEventListener('DOMContentLoaded', () => {
    const state = {
        activities: [],
        ui: {
            expandedActivities: new Set(),
        },
    };

    const activityList = document.getElementById('activity-list');
    const addActivityInput = document.getElementById('add-activity-input');
    const addActivityBtn = document.getElementById('add-activity-btn');
    const logoutBtnSidebar = document.getElementById('logout-btn-sidebar');
    const confirmationModal = document.getElementById('confirmation-modal');
    const confirmationMessage = document.getElementById('confirmation-message');
    const confirmYes = document.getElementById('confirm-yes');
    const confirmNo = document.getElementById('confirm-no');
    
    // Edit modal elements
    const editActivityModal = document.getElementById('edit-activity-modal');
    const editActivityName = document.getElementById('edit-activity-name');
    const saveActivityEditBtn = document.getElementById('save-activity-edit');
    const cancelActivityEdit = document.getElementById('cancel-activity-edit');
    
    const editSubactivityModal = document.getElementById('edit-subactivity-modal');
    const editSubactivityName = document.getElementById('edit-subactivity-name');
    const editSubactivityColor = document.getElementById('edit-subactivity-color');
    const saveSubactivityEditBtn = document.getElementById('save-subactivity-edit');
    const cancelSubactivityEdit = document.getElementById('cancel-subactivity-edit');

    let userId = null;
    let db;
    let confirmationAction = null;
    let currentEditingActivity = null;
    let currentEditingSubActivity = null;

    const showConfirmation = (message, onConfirm) => {
        confirmationMessage.textContent = message;
        confirmationAction = onConfirm;
        confirmationModal.classList.remove('hidden');
    };

    const showEditActivityModal = (activity) => {
        currentEditingActivity = activity;
        editActivityName.value = activity.name;
        editActivityModal.classList.remove('hidden');
    };

    const hideEditActivityModal = () => {
        editActivityModal.classList.add('hidden');
        currentEditingActivity = null;
    };

    const showEditSubactivityModal = (activity, subActivity) => {
        currentEditingActivity = activity;
        currentEditingSubActivity = subActivity;
        editSubactivityName.value = subActivity.name;
        editSubactivityColor.value = subActivity.color || '#3B82F6';
        editSubactivityModal.classList.remove('hidden');
    };

    const hideEditSubactivityModal = () => {
        editSubactivityModal.classList.add('hidden');
        currentEditingActivity = null;
        currentEditingSubActivity = null;
    };

    const saveState = async () => {
        if (!userId) return;
        try {
            const dataToSave = {
                activities: state.activities,
            };
            await db.collection('users').doc(userId).set(dataToSave, { merge: true });
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
                state.activities = loadedData.activities || [];
            }
        } catch (e) {
            console.error("Error loading state from Firebase:", e);
        }
    };

    const renderActivities = () => {
        activityList.innerHTML = '';
        if (state.activities.length === 0) {
            activityList.innerHTML = '<p style="padding: 0 1rem; opacity: 0.7;">Add a main activity to begin.</p>';
            return;
        }

        state.activities.forEach(activity => {
            const isExpanded = state.ui.expandedActivities.has(activity.id);
            const activityItem = document.createElement('li');
            activityItem.className = `activity-item ${isExpanded ? 'expanded' : ''}`;
            activityItem.dataset.id = activity.id;

            let subActivitiesHtml = '';
            if (activity.subActivities && activity.subActivities.length > 0) {
                subActivitiesHtml = `
                    <ul class="sub-activity-list">
                        ${activity.subActivities.map(sub => `
                            <li class="sub-activity-item" data-id="${sub.id}">
                                <div style="display: flex; align-items: center; gap: 0.5em; flex: 1;">
                                    <span class="color-dot" style="background-color: ${sub.color || '#888'}"></span>
                                    <span>${sub.name}</span>
                                </div>
                                <div class="activity-actions">
                                    <button class="edit-btn edit-sub-btn" data-id="${sub.id}" data-parent-id="${activity.id}">✏️</button>
                                    <button class="remove-btn" data-id="${sub.id}" data-parent-id="${activity.id}">&times;</button>
                                </div>
                            </li>
                        `).join('')}
                    </ul>
                `;
            }

            let subAddRowHtml = '';
            if (isExpanded) {
                subAddRowHtml = `
                <div class="sub-add-row">
                    <input type="color" class="sub-activity-color-picker" value="#3B82F6">
                    <input type="text" class="add-input sub-activity-input" placeholder="Add sub-activity...">
                    <button class="add-btn sub-add-btn" aria-label="Add sub-activity">&#10148;</button>
                </div>`;
            }

            activityItem.innerHTML = `
                <div class="activity-main">
                    <div style="display: flex; align-items: center; gap: 0.5em; flex: 1;">
                        <span>${isExpanded ? '▼' : '►'}</span>
                        <span>${activity.name}</span>
                    </div>
                    <div class="activity-actions">
                        <button class="edit-btn edit-activity-btn" data-id="${activity.id}">✏️</button>
                        <button class="remove-btn" data-id="${activity.id}">&times;</button>
                    </div>
                </div>
                ${subActivitiesHtml}
                ${subAddRowHtml}
            `;
            activityList.appendChild(activityItem);
        });
    };

    const handleActivityActions = (e) => {
        const target = e.target;
        const activityItem = target.closest('.activity-item');
        if (!activityItem) return;
        const activityId = activityItem.dataset.id;

        // Handle main activity click (expand/collapse)
        if (target.closest('.activity-main') && !target.classList.contains('remove-btn') && !target.classList.contains('edit-btn')) {
            if (state.ui.expandedActivities.has(activityId)) {
                state.ui.expandedActivities.delete(activityId);
            } else {
                state.ui.expandedActivities.add(activityId);
            }
            saveState();
            renderActivities();
            return;
        }

        // Handle edit activity button
        if (target.classList.contains('edit-activity-btn')) {
            e.stopPropagation();
            const activity = state.activities.find(a => a.id === activityId);
            if (activity) {
                showEditActivityModal(activity);
            }
            return;
        }

        // Handle edit sub-activity button
        if (target.classList.contains('edit-sub-btn')) {
            e.stopPropagation();
            const subId = target.dataset.id;
            const activity = state.activities.find(a => a.id === activityId);
            const subActivity = activity ? activity.subActivities.find(s => s.id === subId) : null;
            if (activity && subActivity) {
                showEditSubactivityModal(activity, subActivity);
            }
            return;
        }

        const subActivityInput = target.closest('.sub-add-row')?.querySelector('.sub-activity-input');
        if ((target.classList.contains('sub-add-btn') || (target === subActivityInput && e.key === 'Enter')) && subActivityInput && subActivityInput.value.trim()) {
            const name = subActivityInput.value.trim();
            const colorPicker = subActivityInput.previousElementSibling;
            const color = colorPicker.value;
            const newSubActivity = { id: `sub_${Date.now()}`, name, color };

            const activity = state.activities.find(a => a.id === activityId);
            if (activity) {
                if (!activity.subActivities) activity.subActivities = [];
                activity.subActivities.push(newSubActivity);
                subActivityInput.value = '';
                saveState();
                renderActivities();
            }
            return;
        }

        if (target.classList.contains('remove-btn') && target.closest('.activity-main')) {
            e.stopPropagation();
            const activityToDelete = state.activities.find(a => a.id === activityId);
            if (activityToDelete) {
                showConfirmation(`Are you sure you want to delete "${activityToDelete.name}" and all its data? This action cannot be undone.`, async () => {
                    try {
                        // Find all logs associated with this activityId (includes main and all sub-activities)
                        const snapshot = await db.collection('users').doc(userId).collection('logs')
                            .where('activityId', '==', activityId).get();

                        const batch = db.batch();
                        snapshot.docs.forEach(doc => {
                            batch.delete(doc.ref);
                        });
                        await batch.commit();
                        console.log('Associated logs deleted.');

                        // Now remove the activity from the state and save
                        state.activities = state.activities.filter(a => a.id !== activityId);
                        await saveState();
                        
                        console.log('Activity deleted from state.');
                    } catch (err) {
                        console.error("Error removing activity and its logs:", err);
                        alert("Failed to delete activity. Please check the console for details.");
                    } finally {
                        renderActivities();
                    }
                });
            }
        }

        if (target.classList.contains('remove-btn') && target.closest('.sub-activity-item')) {
            e.stopPropagation();
            const subId = target.dataset.id;
            const activity = state.activities.find(a => a.id === activityId);
            const subActivity = activity ? activity.subActivities.find(s => s.id === subId) : null;
            
            if (activity && subActivity) {
                showConfirmation(`Are you sure you want to delete sub-activity "${subActivity.name}" and its logged data? This action cannot be undone.`, async () => {
                    try {
                        // Delete logs for this sub-activity
                        const snapshot = await db.collection('users').doc(userId).collection('logs')
                            .where('subActivityId', '==', subId).get();
                        
                        const batch = db.batch();
                        snapshot.docs.forEach(doc => batch.delete(doc.ref));
                        await batch.commit();
                        console.log('Sub-activity logs deleted.');

                        // Remove sub-activity from state and save
                        activity.subActivities = activity.subActivities.filter(s => s.id !== subId);
                        await saveState();
                        
                        console.log('Sub-activity deleted from state.');

                    } catch (err) {
                        console.error("Error removing sub-activity and its logs:", err);
                        alert("Failed to delete sub-activity. Please check the console for details.");
                    } finally {
                        renderActivities();
                    }
                });
            }
        }
    };

    const initApp = async () => {
        await loadState();
        renderActivities();
        if(logoutBtnSidebar) logoutBtnSidebar.classList.remove('hidden');
    };

    const saveActivityEdit = async () => {
        if (!currentEditingActivity) return;
        
        const newName = editActivityName.value.trim();
        if (!newName) {
            alert('Please enter a valid activity name.');
            return;
        }

        // Update activity name
        currentEditingActivity.name = newName;
        
        try {
            await saveState();
            renderActivities();
            hideEditActivityModal();
        } catch (error) {
            console.error('Error saving activity edit:', error);
            alert('Failed to save changes. Please try again.');
        }
    };

    const saveSubactivityEdit = async () => {
        if (!currentEditingActivity || !currentEditingSubActivity) return;
        
        const newName = editSubactivityName.value.trim();
        const newColor = editSubactivityColor.value;
        
        if (!newName) {
            alert('Please enter a valid sub-activity name.');
            return;
        }

        // Update sub-activity name and color
        currentEditingSubActivity.name = newName;
        currentEditingSubActivity.color = newColor;
        
        try {
            await saveState();
            renderActivities();
            hideEditSubactivityModal();
        } catch (error) {
            console.error('Error saving sub-activity edit:', error);
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

    const addActivity = () => {
        const name = addActivityInput.value.trim();
        if (name) {
            const newActivity = {
                id: `act_${Date.now()}`,
                name,
                subActivities: [],
            };
            state.activities.push(newActivity);
            addActivityInput.value = '';
            saveState();
            renderActivities();
        }
    };

    addActivityInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') addActivity();
    });
    addActivityBtn.addEventListener('click', addActivity);
    activityList.addEventListener('click', handleActivityActions);
    activityList.addEventListener('keyup', handleActivityActions);

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
    saveActivityEditBtn.addEventListener('click', saveActivityEdit);
    cancelActivityEdit.addEventListener('click', hideEditActivityModal);
    
    saveSubactivityEditBtn.addEventListener('click', saveSubactivityEdit);
    cancelSubactivityEdit.addEventListener('click', hideEditSubactivityModal);
    
    // Close modals when clicking outside
    editActivityModal.addEventListener('click', (e) => {
        if (e.target === editActivityModal) {
            hideEditActivityModal();
        }
    });
    
    editSubactivityModal.addEventListener('click', (e) => {
        if (e.target === editSubactivityModal) {
            hideEditSubactivityModal();
        }
    });
    
    // Handle Enter key in edit forms
    editActivityName.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') saveActivityEdit();
    });
    
    editSubactivityName.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') saveSubactivityEdit();
    });

    setupAuth();
});
