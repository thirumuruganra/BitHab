// BitHab - A Habit Tracking Application
// © 2025, All Rights Reserved.

document.addEventListener('DOMContentLoaded', () => {
    const state = {
        activities: [],
        goals: [],
        logs: {},
        notes: {}, // Add notes storage
        metadata: {
            firstActivityDate: null // Track first ever activity date
        },
        ui: {
            currentDate: new Date(),
            selectedActivityId: null,
            expandedActivities: new Set(),
        },
    };

    // DOM Elements
    const activityList = document.getElementById('activity-list');
    const addActivityInput = document.getElementById('add-activity-input');
    const goalList = document.getElementById('goal-list');
    const addGoalInput = document.getElementById('add-goal-input');
    const calendarView = document.querySelector('.calendar-view');
    const loggingModal = document.getElementById('logging-modal');
    const loadingIndicator = document.getElementById('loading-indicator');
    const authContainer = document.getElementById('auth-container');
    const mainLayout = document.querySelector('.main-layout');
    const logoutBtn = document.getElementById('logout-btn');
    const logoutBtnSidebar = document.getElementById('logout-btn-sidebar');
    const confirmationModal = document.getElementById('confirmation-modal');
    const confirmationMessage = document.getElementById('confirmation-message');
    const confirmYes = document.getElementById('confirm-yes');
    const confirmNo = document.getElementById('confirm-no');
    const addActivityBtn = document.getElementById('add-activity-btn');
    const addGoalBtn = document.getElementById('add-goal-btn');

    let userId = null;
    let confirmationAction = null;

    const showConfirmation = (message, onConfirm) => {
        confirmationMessage.textContent = message;
        confirmationAction = onConfirm;
        confirmationModal.classList.remove('hidden');
    };
    
        // --- Firebase State Management ---
    const saveState = async () => {
        if (!userId) return;
        try {
            const uiStateToSave = {
                selectedActivityId: state.ui.selectedActivityId,
            };
            // Use set with merge to only update the ui field and not overwrite other root fields.
            await db.collection('users').doc(userId).set({ 
                ui: uiStateToSave,
                metadata: state.metadata
            }, { merge: true });
        } catch (e) {
            console.error("Error saving UI state to Firebase:", e);
        }
    };

    const saveLogs = async () => {
        if (!userId) return;
        try {
            const batch = db.batch();
            
            // Track first activity date
            const allDates = Object.keys(state.logs).filter(dateStr => 
                state.logs[dateStr] && state.logs[dateStr].length > 0
            );
            
            if (allDates.length > 0) {
                const earliestDate = allDates.sort()[0];
                if (!state.metadata.firstActivityDate || earliestDate < state.metadata.firstActivityDate) {
                    state.metadata.firstActivityDate = earliestDate;
                }
            }
            
            // Save each date's logs as a separate document in the logs subcollection
            Object.keys(state.logs).forEach(dateStr => {
                const logRef = db.collection('users').doc(userId).collection('logs').doc(dateStr);
                batch.set(logRef, { loggedSubActivityIds: state.logs[dateStr] });
            });
            
            // Save metadata with first activity date
            const userRef = db.collection('users').doc(userId);
            batch.set(userRef, { metadata: state.metadata }, { merge: true });
            
            await batch.commit();
        } catch (e) {
            console.error("Error saving logs to Firebase:", e);
        }
    };

    const deleteLogsFromFirebase = async (dateStr) => {
        if (!userId || !dateStr) return;
        try {
            await db.collection('users').doc(userId).collection('logs').doc(dateStr).delete();
        } catch (e) {
            console.error("Error deleting logs from Firebase:", e);
        }
    };

    const saveNotes = async (dateStr, note) => {
        if (!userId || !dateStr) return;
        try {
            if (note && note.trim()) {
                // Save note if it has content
                await db.collection('users').doc(userId).collection('notes').doc(dateStr).set({ note: note.trim() });
                state.notes[dateStr] = note.trim();
            } else {
                // Delete note if it's empty
                await db.collection('users').doc(userId).collection('notes').doc(dateStr).delete();
                delete state.notes[dateStr];
            }
        } catch (e) {
            console.error("Error saving note to Firebase:", e);
        }
    };

    const loadState = async () => {
        if (!userId) return;
        try {
            const userDoc = await db.collection('users').doc(userId).get();
            if (userDoc.exists) {
                const data = userDoc.data();
                state.activities = data.activities || [];
                state.goals = data.goals || [];
                state.metadata = data.metadata || { firstActivityDate: null };
                
                if (data.ui) {
                    state.ui.selectedActivityId = data.ui.selectedActivityId || null;
                    // Always start with current date (today's month)
                    state.ui.currentDate = new Date();
                }
            }

            // Select the first activity by default if none is selected
            if (!state.ui.selectedActivityId && state.activities.length > 0) {
                state.ui.selectedActivityId = state.activities[0].id;
            }

            // Load logs separately as they are in a sub-collection
            const logsSnapshot = await db.collection('users').doc(userId).collection('logs').get();
            state.logs = {}; // Reset logs before loading
            logsSnapshot.forEach(doc => {
                state.logs[doc.id] = doc.data().loggedSubActivityIds;
            });

            // Load notes separately as they are in a sub-collection
            const notesSnapshot = await db.collection('users').doc(userId).collection('notes').get();
            state.notes = {}; // Reset notes before loading
            notesSnapshot.forEach(doc => {
                state.notes[doc.id] = doc.data().note;
            });

        } catch (e) {
            console.error("Error loading state from Firebase:", e);
        }
        
    };

    // --- Streak Calculation Functions ---
    const calculateStreaks = (activityId) => {
        const today = new Date();
        const logs = state.logs;
        
        // Helper function to format date as YYYY-MM-DD
        const formatDate = (date) => {
            return date.getFullYear() + '-' + 
                   String(date.getMonth() + 1).padStart(2, '0') + '-' + 
                   String(date.getDate()).padStart(2, '0');
        };
        
        // Helper function to check if activity was logged on a specific date
        const isActivityLoggedOnDate = (dateStr) => {
            const dayLogs = logs[dateStr];
            if (!dayLogs || !Array.isArray(dayLogs)) return false;
            
            // Find the activity object
            const activity = state.activities.find(a => a.id === activityId);
            if (!activity) return false;
            
            // Check if main activity was logged
            if (dayLogs.includes(activityId)) return true;
            
            // Check if any sub-activities were logged
            if (activity.subActivities && activity.subActivities.length > 0) {
                return activity.subActivities.some(sub => dayLogs.includes(sub.id));
            }
            
            return false;
        };
        
        // Calculate current streak (going backwards from today)
        let currentStreak = 0;
        const currentDate = new Date(today);
        
        // Start from today and go backwards
        while (true) {
            const dateStr = formatDate(currentDate);
            if (isActivityLoggedOnDate(dateStr)) {
                currentStreak++;
                currentDate.setDate(currentDate.getDate() - 1);
            } else {
                break;
            }
        }
        
        // Calculate longest streak by checking all dates
        let longestStreak = 0;
        let tempStreak = 0;
        
        // Get all logged dates and sort them
        const allDates = Object.keys(logs).sort();
        
        if (allDates.length > 0) {
            const startDate = new Date(allDates[0]);
            const endDate = new Date(Math.max(today.getTime(), new Date(allDates[allDates.length - 1]).getTime()));
            
            const checkDate = new Date(startDate);
            while (checkDate <= endDate) {
                const dateStr = formatDate(checkDate);
                if (isActivityLoggedOnDate(dateStr)) {
                    tempStreak++;
                    longestStreak = Math.max(longestStreak, tempStreak);
                } else {
                    tempStreak = 0;
                }
                checkDate.setDate(checkDate.getDate() + 1);
            }
        }
        
        return { currentStreak, longestStreak };
    };

    // --- UI Rendering ---
    const renderActivities = (isLoading = false) => {
        if (isLoading) {
            activityList.innerHTML = '<p style="padding: 0 1rem; opacity: 0.7;">Loading activities...</p>';
            return;
        }
        activityList.innerHTML = '';
        if (state.activities.length === 0) {
            activityList.innerHTML = '<p style="padding: 0 1rem; opacity: 0.7;">No activities found. Add some in the "Manage Activities" page.</p>';
            return;
        }

        state.activities.forEach(activity => {
            const isSelected = state.ui.selectedActivityId === activity.id;
            const { currentStreak, longestStreak } = calculateStreaks(activity.id);
            
            const activityItem = document.createElement('li');
            activityItem.className = `activity-item ${isSelected ? 'selected' : ''}`;
            activityItem.dataset.id = activity.id;
            
            // Create streak display
            let streakDisplay = '';
            if (currentStreak > 0 || longestStreak > 0) {
                streakDisplay = `
                    <div class="streak-info">
                        ${currentStreak > 0 ? `<div class="current-streak">🔥 Current: ${currentStreak} day${currentStreak !== 1 ? 's' : ''}</div>` : ''}
                        ${longestStreak > 0 ? `<div class="longest-streak">🏆 Longest: ${longestStreak} day${longestStreak !== 1 ? 's' : ''}</div>` : ''}
                    </div>
                `;
            }
            
            activityItem.innerHTML = `
                <div class="activity-main">
                    <span>${activity.name}</span>
                </div>
                ${streakDisplay}
            `;
            activityList.appendChild(activityItem);
        });
    };

    const renderGoals = (isLoading = false) => {
        if (isLoading) {
            goalList.innerHTML = '<p style="padding: 0 1rem; opacity: 0.7;">Loading goals...</p>';
            return;
        }
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
                <span>${goal.name}</span>
            `;
            goalList.appendChild(goalItem);
        });
    };

    const getDotsForDate = (activity, dateStr) => {
        if (!activity) return '';
        const loggedIds = new Set(state.logs[dateStr] || []);
        
        if (activity.subActivities && activity.subActivities.length > 0) {
            return activity.subActivities
                .filter(sub => loggedIds.has(sub.id))
                .map(sub => `<span class="calendar-dot" style="background-color: ${sub.color};"></span>`)
                .join('');
        } else if (loggedIds.has(activity.id)) {
            return `<span class="calendar-dot" style="background-color: var(--text-primary);"></span>`;
        }
        
        return '';
    };

    const renderCalendar = (isLoading = false) => {
        if (isLoading) {
            calendarView.innerHTML = '<div style="text-align: center; opacity: 0.7; padding-top: 2rem;">Loading calendar...</div>';
            return;
        }
        const activityId = state.ui.selectedActivityId;
        if (!activityId) {
            calendarView.innerHTML = '<div style="text-align: center; opacity: 0.7; padding-top: 2rem;">Select an activity to see its calendar.</div>';
            return;
        }

        const activity = state.activities.find(a => a.id === activityId);
        if (!activity) return;

        const date = state.ui.currentDate;
        const year = date.getFullYear();
        const month = date.getMonth();
        const monthName = date.toLocaleString('default', { month: 'long' });

        // A single grid for headers and days ensures alignment.
        calendarView.innerHTML = `
            <div class="calendar-header">
                <button id="prev-month" class="calendar-nav-btn">‹</button>
                <div class="calendar-title-container">
                    <h2 class="calendar-title">${monthName} ${year}</h2>
                    <h3 class="current-activity-title">${activity.name}</h3>
                </div>
                <button id="next-month" class="calendar-nav-btn">›</button>
            </div>
            <div class="calendar-grid" id="calendar-grid">
                <!-- Weekdays and days will be injected here -->
            </div>
        `;

        const calendarGrid = document.getElementById('calendar-grid');
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const prevMonthLastDate = new Date(year, month, 0);
        const prevMonthDays = prevMonthLastDate.getDate();

        let gridHTML = '';

        // Add weekday headers
        ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(day => {
            gridHTML += `<div class="weekday">${day}</div>`;
        });

        // Days from previous month
        for (let i = firstDay; i > 0; i--) {
            const day = prevMonthDays - i + 1;
            const dateStr = `${prevMonthLastDate.getFullYear()}-${String(prevMonthLastDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dots = getDotsForDate(activity, dateStr);
            gridHTML += `
                <div class="calendar-day other-month" data-date="${dateStr}">
                    <span class="calendar-date-num">${day}</span>
                    <div class="calendar-dots">${dots}</div>
                </div>`;
        }

        // Days from current month
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dots = getDotsForDate(activity, dateStr);
            gridHTML += `
                <div class="calendar-day" data-date="${dateStr}">
                    <span class="calendar-date-num">${day}</span>
                    <div class="calendar-dots">${dots}</div>
                </div>`;
        }

        // Days from next month
        const totalCells = 42; // 6 rows * 7 days
        const renderedCells = firstDay + daysInMonth;
        const remainingCells = totalCells - renderedCells;
        const nextMonthFirstDate = new Date(year, month + 1, 1);

        for (let i = 1; i <= remainingCells; i++) {
            const day = i;
            const dateStr = `${nextMonthFirstDate.getFullYear()}-${String(nextMonthFirstDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dots = getDotsForDate(activity, dateStr);
            gridHTML += `
                <div class="calendar-day other-month" data-date="${dateStr}">
                    <span class="calendar-date-num">${day}</span>
                    <div class="calendar-dots">${dots}</div>
                </div>`;
        }
        
        calendarGrid.innerHTML = gridHTML;
    };

    const openNotesOnlyModal = (dateStr, activity) => {
        const formatDateForModal = (ds) => {
            const [year, month, day] = ds.split('-').map(Number);
            const date = new Date(year, month - 1, day);
            const monthName = date.toLocaleString('default', { month: 'long' });
            let dayWithSuffix;
            if (day > 3 && day < 21) {
                dayWithSuffix = `${day}th`;
            } else {
                switch (day % 10) {
                    case 1: dayWithSuffix = `${day}st`; break;
                    case 2: dayWithSuffix = `${day}nd`; break;
                    case 3: dayWithSuffix = `${day}rd`; break;
                    default: dayWithSuffix = `${day}th`; break;
                }
            }
            return `${dayWithSuffix} ${monthName}`;
        };

        // Check if activity is currently logged for this date
        const isLogged = state.logs[dateStr] && state.logs[dateStr].includes(activity.id);
        const statusMessage = isLogged 
            ? `✅ <strong>${activity.name}</strong> is logged for this day!`
            : `❌ <strong>${activity.name}</strong> was removed from this day.`;

        // Display notes as read-only
        const notesContent = state.notes[dateStr] 
            ? `<div class="notes-display">${state.notes[dateStr]}</div>`
            : `<div class="notes-display no-notes">No notes for this day. <a href="pages/notes.html">Add notes here</a>.</div>`;

        loggingModal.innerHTML = `
            <div class="modal-content">
                <span class="close">&times;</span>
                <h3>${formatDateForModal(dateStr)}</h3>
                <p>${statusMessage}</p>
                <div class="notes-section">
                    <label>📝 Notes for this day:</label>
                    ${notesContent}
                </div>
            </div>
        `;

        loggingModal.classList.remove('hidden');
        loggingModal.dataset.date = dateStr;
    };

    const openLoggingModal = (dateStr) => {
        const activityId = state.ui.selectedActivityId;
        const activity = state.activities.find(a => a.id === activityId);
        if (!activity) {
            return;
        }

        const formatDateForModal = (ds) => {
            const [year, month, day] = ds.split('-').map(Number);
            const date = new Date(year, month - 1, day);
            const monthName = date.toLocaleString('default', { month: 'long' });
            let dayWithSuffix;
            if (day > 3 && day < 21) {
                dayWithSuffix = `${day}th`;
            } else {
                switch (day % 10) {
                    case 1: dayWithSuffix = `${day}st`; break;
                    case 2: dayWithSuffix = `${day}nd`; break;
                    case 3: dayWithSuffix = `${day}rd`; break;
                    default: dayWithSuffix = `${day}th`; break;
                }
            }
            return `${dayWithSuffix} ${monthName}`;
        };

        // Create pills section only if there are sub-activities
        let pillsSection = '';
        if (activity.subActivities && activity.subActivities.length > 0) {
            const loggedIds = new Set(state.logs[dateStr] || []);
            pillsSection = `
                <div id="pill-container">
                    ${activity.subActivities.map(sub => {
                        const isSelected = loggedIds.has(sub.id);
                        return `<div class="pill ${isSelected ? 'selected' : ''}" data-id="${sub.id}" style="--pill-color: ${sub.color}">
                            ${sub.name}
                        </div>`;
                    }).join('')}
                </div>
            `;
        } else {
            // For activities without sub-activities, show main activity as a pill
            const isLogged = state.logs[dateStr] && state.logs[dateStr].includes(activity.id);
            pillsSection = `
                <div id="pill-container">
                    <div class="pill ${isLogged ? 'selected' : ''}" data-id="${activity.id}" style="--pill-color: var(--accent-primary)">
                        ${activity.name}
                    </div>
                </div>
            `;
        }

        // Display notes as read-only
        const notesContent = state.notes[dateStr] 
            ? `<div class="notes-display">${state.notes[dateStr]}</div>`
            : `<div class="notes-display no-notes">No notes for this day. <a href="pages/notes.html">Add notes here</a>.</div>`;

        loggingModal.innerHTML = `
            <div class="modal-content">
                <span class="close">&times;</span>
                <h3>${formatDateForModal(dateStr)}</h3>
                <p>Activity: <strong>${activity.name}</strong></p>
                ${pillsSection}
                <div class="notes-section">
                    <label>📝 Notes for this day:</label>
                    ${notesContent}
                </div>
            </div>
            </div>
        `;

        // Set initial pill selections for sub-activities
        if (activity.subActivities && activity.subActivities.length > 0) {
            const loggedIds = new Set(state.logs[dateStr] || []);
            loggingModal.querySelectorAll('.pill').forEach(pill => {
                if (loggedIds.has(pill.dataset.id)) {
                    pill.classList.add('selected');
                }
            });
        }

        loggingModal.classList.remove('hidden');
        loggingModal.dataset.date = dateStr;
    };

    // --- Event Handlers ---
    const handleActivityActions = (e) => {
        const target = e.target;
        const activityItem = target.closest('.activity-item');
        if (!activityItem) return;
        const activityId = activityItem.dataset.id;

        if (target.closest('.activity-main')) {
            state.ui.selectedActivityId = activityId;
            saveState();
            renderActivities();
            if (calendarView) {
                renderCalendar();
            }
        }
    };

    const handleGoalActions = (e) => {
        const target = e.target;
        const goalItem = target.closest('.goal-item');
        if (goalItem) {
            const goalId = goalItem.dataset.id;
            const goal = state.goals.find(g => g.id === goalId);
            if (goal) {
                goal.completed = !goal.completed;
                db.collection('users').doc(userId).set({ goals: state.goals }, { merge: true });
                renderGoals();
            }
        }
    };

    const handleCalendarActions = async (e) => {
        const target = e.target;
        const navButton = target.closest('.calendar-nav-btn');
        if (navButton) {
            const direction = navButton.id === 'prev-month' ? -1 : 1;
            state.ui.currentDate.setMonth(state.ui.currentDate.getMonth() + direction);
            saveState(); // Save the new month
            renderCalendar();
            return;
        }

        const dayCell = target.closest('.calendar-day:not(.empty)');
        if (dayCell) {
            const dateStr = dayCell.dataset.date;
            const activityId = state.ui.selectedActivityId;
            const activity = state.activities.find(a => a.id === activityId);

            if (activity) {
                // If activity has no subactivities, toggle it and show notes modal
                if (!activity.subActivities || activity.subActivities.length === 0) {
                    // Initialize logs for this date if needed
                    if (!state.logs[dateStr]) {
                        state.logs[dateStr] = [];
                    }
                    
                    const isAlreadyLogged = state.logs[dateStr].includes(activity.id);
                    
                    if (isAlreadyLogged) {
                        // Remove (de-log) the activity
                        state.logs[dateStr] = state.logs[dateStr].filter(id => id !== activity.id);
                        
                        // If no activities logged for this date, delete the entry
                        if (state.logs[dateStr].length === 0) {
                            delete state.logs[dateStr];
                            await deleteLogsFromFirebase(dateStr);
                        } else {
                            await saveLogs();
                        }
                    } else {
                        // Add (log) the activity
                        state.logs[dateStr].push(activity.id);
                        await saveLogs();
                    }
                    
                    // Open modal only for notes
                    openNotesOnlyModal(dateStr, activity);
                } else {
                    // For activities with subactivities, show the full modal
                    openLoggingModal(dateStr);
                }
            }
        }
    };

    const handleModalActions = async (e) => {
        const target = e.target;
        const dateStr = loggingModal.dataset.date;

        // Close button or clicking outside the modal content
        if (target.classList.contains('close') || target.id === 'logging-modal') {
            loggingModal.classList.add('hidden');
            renderCalendar();
            renderActivities();
            return;
        }

        const pill = target.closest('.pill');
        if (pill) {
            // Toggle pill selection and autosave
            pill.classList.toggle('selected');
            
            // Auto-save the current selections
            const loggedIds = new Set();
            loggingModal.querySelectorAll('.pill.selected').forEach(selectedPill => {
                loggedIds.add(selectedPill.dataset.id);
            });

            if (loggedIds.size === 0) {
                delete state.logs[dateStr];
                await deleteLogsFromFirebase(dateStr);
            } else {
                state.logs[dateStr] = Array.from(loggedIds);
                await saveLogs();
            }
            
            // Update calendar display immediately
            renderCalendar();
            renderActivities();
            
            // Auto-close modal after subactivity selection for better UX
            // Give a brief moment to show the selection, then close
            setTimeout(() => {
                loggingModal.classList.add('hidden');
            }, 500);
        }
    };

    // --- Utility Functions ---
    const showLoadingIndicator = (message, isError = false) => {
        loadingIndicator.textContent = message;
        loadingIndicator.style.backgroundColor = isError ? '#e53935' : 'var(--accent-primary)';
        loadingIndicator.classList.remove('hidden');
        setTimeout(() => loadingIndicator.classList.add('hidden'), 1500);
    };

    // --- Initial Setup ---
    const initApp = async () => {
        // Render initial loading states
        renderActivities(true);
        renderGoals(true);
        renderCalendar(true);

        await loadState();

        if (!state.ui.selectedActivityId && state.activities.length > 0) {
            state.ui.selectedActivityId = state.activities[0].id;
        }
        if (state.ui.selectedActivityId && !state.activities.find(a => a.id === state.ui.selectedActivityId)) {
            state.ui.selectedActivityId = state.activities.length > 0 ? state.activities[0].id : null;
        }
        
        renderActivities();
        renderGoals();
        renderCalendar();

        // Show main layout after everything is ready
        document.querySelector('.main-layout').classList.remove('hidden');
        if(logoutBtn) logoutBtn.classList.remove('hidden');
        if(logoutBtnSidebar) logoutBtnSidebar.classList.remove('hidden');
    }

    // Only handle logout and auth state for main app
    const setupAuth = () => {
        const handleLogout = () => {
            showConfirmation('Are you sure you want to logout?', () => {
                firebase.auth().signOut();
            });
        };

        if(logoutBtn) logoutBtn.addEventListener('click', handleLogout);
        if(logoutBtnSidebar) logoutBtnSidebar.addEventListener('click', handleLogout);

        firebase.auth().onAuthStateChanged(user => {
            if (user) {
                userId = user.uid;
                db = firebase.firestore();
                initApp();
            } else {
                userId = null;
                // Redirect to login if not authenticated
                if (!window.location.pathname.endsWith('login.html') && !window.location.pathname.endsWith('register.html')) {
                    window.location.href = 'pages/login.html';
                }
            }
        });
    };

    const init = () => {
        setupAuth();

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

        activityList.addEventListener('click', handleActivityActions);
        goalList.addEventListener('click', handleGoalActions);
        calendarView.addEventListener('click', handleCalendarActions);
        loggingModal.addEventListener('click', handleModalActions);

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
    };

    // --- Global Functions for Cross-File Access ---
    window.getAppState = () => state;
    window.getFirstActivityDate = () => state.metadata.firstActivityDate;

    init();
});
