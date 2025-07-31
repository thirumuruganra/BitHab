// BitHab - A Habit Tracking Application
// © 2025, All Rights Reserved.

document.addEventListener('DOMContentLoaded', () => {
    const state = {
        activities: [],
        goals: [],
        logs: {},
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
    const themeToggle = document.getElementById('theme-toggle');
    const themeToggleSidebar = document.getElementById('theme-toggle-sidebar');
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
                currentDate: state.ui.currentDate.toISOString(),
                selectedActivityId: state.ui.selectedActivityId,
            };
            // Use set with merge to only update the ui field and not overwrite other root fields.
            await db.collection('users').doc(userId).set({ ui: uiStateToSave }, { merge: true });
        } catch (e) {
            console.error("Error saving UI state to Firebase:", e);
        }
    };

    const saveLogs = async () => {
        if (!userId) return;
        try {
            const batch = db.batch();
            
            // Save each date's logs as a separate document in the logs subcollection
            Object.keys(state.logs).forEach(dateStr => {
                const logRef = db.collection('users').doc(userId).collection('logs').doc(dateStr);
                batch.set(logRef, { loggedSubActivityIds: state.logs[dateStr] });
            });
            
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

    const loadState = async () => {
        if (!userId) return;
        try {
            const userDoc = await db.collection('users').doc(userId).get();
            if (userDoc.exists) {
                const data = userDoc.data();
                state.activities = data.activities || [];
                state.goals = data.goals || [];
                if (data.ui) {
                    state.ui.selectedActivityId = data.ui.selectedActivityId || null;
                    // This check prevents the "Invalid Date" error.
                    if (data.ui.currentDate && !isNaN(new Date(data.ui.currentDate))) {
                        state.ui.currentDate = new Date(data.ui.currentDate);
                    } else {
                        state.ui.currentDate = new Date();
                    }
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

    const openLoggingModal = (dateStr) => {
        const activityId = state.ui.selectedActivityId;
        const activity = state.activities.find(a => a.id === activityId);
        if (!activity || !activity.subActivities || activity.subActivities.length === 0) {
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

        loggingModal.innerHTML = `
            <div class="modal-content">
                <span class="close">&times;</span>
                <h3>${formatDateForModal(dateStr)}</h3>
                <p>Activity: <strong>${activity.name}</strong></p>
                <div id="pill-container">
                    ${activity.subActivities.map(sub => `
                        <div class="pill" data-id="${sub.id}" style="--pill-color: ${sub.color}">
                            ${sub.name}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        const loggedIds = new Set(state.logs[dateStr] || []);
        loggingModal.querySelectorAll('.pill').forEach(pill => {
            if (loggedIds.has(pill.dataset.id)) {
                pill.classList.add('selected');
            }
        });

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
                // If the activity has sub-activities, open the modal for selection.
                if (activity.subActivities && activity.subActivities.length > 0) {
                    openLoggingModal(dateStr);
                } else {
                    // Otherwise, directly toggle the log for the main activity.
                    if (!state.logs[dateStr]) {
                        state.logs[dateStr] = [];
                    }
                    const logIndex = state.logs[dateStr].indexOf(activity.id);
                    if (logIndex > -1) {
                        // Already logged, so remove it (un-log).
                        state.logs[dateStr].splice(logIndex, 1);
                        if (state.logs[dateStr].length === 0) {
                            delete state.logs[dateStr];
                            await deleteLogsFromFirebase(dateStr); // Delete from Firebase when no logs remain
                        } else {
                            await saveLogs(); // Save logs to Firebase
                        }
                    } else {
                        // Not logged, so add it.
                        state.logs[dateStr].push(activity.id);
                        await saveLogs(); // Save logs to Firebase
                    }
                    renderCalendar(); // Re-render calendar to show/hide the dot.
                    renderActivities(); // Re-render activities to update streak.
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
            const subId = pill.dataset.id;
            
            // Use a Set for easier and more robust toggling
            const loggedIds = new Set(state.logs[dateStr] || []);

            if (loggedIds.has(subId)) {
                loggedIds.delete(subId);
            } else {
                loggedIds.add(subId);
            }

            if (loggedIds.size === 0) {
                delete state.logs[dateStr];
                await deleteLogsFromFirebase(dateStr); // Delete from Firebase when no logs remain
            } else {
                state.logs[dateStr] = Array.from(loggedIds);
                await saveLogs(); // Save logs to Firebase
            }
            
            // Autosave and close
            loggingModal.classList.add('hidden');
            renderCalendar();
            renderActivities();
        }
    };

    // --- Utility Functions ---
    const showLoadingIndicator = (message, isError = false) => {
        loadingIndicator.textContent = message;
        loadingIndicator.style.backgroundColor = isError ? '#e53935' : 'var(--accent-primary)';
        loadingIndicator.classList.remove('hidden');
        setTimeout(() => loadingIndicator.classList.add('hidden'), 1500);
    };

    const toggleTheme = () => {
        document.body.classList.toggle('dark');
        const isDark = document.body.classList.contains('dark');
        const themeIcon = isDark ? '☀️' : '🌙';
        if(themeToggle) themeToggle.innerHTML = themeIcon;
        if(themeToggleSidebar) themeToggleSidebar.innerHTML = themeIcon;
        localStorage.setItem('bitHabTheme', document.body.className);
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
        const savedTheme = localStorage.getItem('bitHabTheme');
        if (savedTheme) document.body.className = savedTheme;
        if(themeToggle) themeToggle.innerHTML = document.body.classList.contains('dark') ? '☀️' : '🌙';
        if(themeToggleSidebar) themeToggleSidebar.innerHTML = document.body.classList.contains('dark') ? '☀️' : '🌙';

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
        if(themeToggle) themeToggle.addEventListener('click', toggleTheme);
        if(themeToggleSidebar) themeToggleSidebar.addEventListener('click', toggleTheme);

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

    init();
});
