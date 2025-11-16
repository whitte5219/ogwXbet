// Firebase imports
import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";

import {
    getDatabase,
    ref,
    onValue,
    push,
    set,
    remove,
    get,
    update
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut,
    updatePassword
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

// Firebase config
const firebaseConfig = {
    apiKey: "AIzaSyDmJpMD7iQSZ_Jtr-mHEYIP4dVRli-Ym8Y",
    authDomain: "ogwxbet.firebaseapp.com",
    databaseURL: "https://ogwxbet-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "ogwxbet",
    storageBucket: "ogwxbet.firebasestorage.app",
    messagingSenderId: "350350599882",
    appId: "1:350350599882:web:cf13802474026f08687633"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

const eventsRef = ref(db, "events");
const eventLogRef = ref(db, "eventLog");
const accountsRef = ref(db, "accounts");

// Map of eventId -> firebase key
window.eventKeyMap = {};

// Save new event to Firebase
window.saveEventToFirebase = function (eventObj) {
    const newRef = push(eventsRef);
    set(newRef, eventObj);
};

// Subscribe to events in Firebase
onValue(eventsRef, snapshot => {
    const events = [];
    const idToKey = {};

    snapshot.forEach(childSnap => {
        const ev = childSnap.val() || {};
        ev._key = childSnap.key;
        events.push(ev);
        if (ev.id) {
            idToKey[ev.id] = childSnap.key;
        }
    });

    window.latestEvents = events;
    window.eventKeyMap = idToKey;

    if (window.displayFirebaseEvents) {
        window.displayFirebaseEvents(events);
    }
});

// Subscribe to event log
onValue(eventLogRef, snapshot => {
    const logs = [];
    snapshot.forEach(childSnap => {
        const entry = childSnap.val() || {};
        entry._key = childSnap.key;
        logs.push(entry);
    });
    window.eventLogEntries = logs;
    if (window.renderEventLog) {
        window.renderEventLog();
    }
});

document.addEventListener('DOMContentLoaded', function () {
    const loginPage = document.getElementById('login-page');
    const dashboardPage = document.getElementById('dashboard-page');
    const accountCreationSection = document.getElementById('account-creation');
    const loginSection = document.getElementById('login-section');
    const statusMessage = document.getElementById('status-message');
    const loginStatus = document.getElementById('login-status');
    const adminNav = document.getElementById('admin-nav');
    const moderatorBadge = document.getElementById('moderator-badge');

    const createAccountBtn = document.getElementById('create-account-btn');
    const loginBtn = document.getElementById('login-btn');
    const showRegisterBtn = document.getElementById('show-register-btn');
    const showLoginBtn = document.getElementById('show-login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const changeTokenBtn = document.getElementById('change-token-btn');
    const toggleTokenBtn = document.getElementById('toggle-token');
    const addEventBtn = document.getElementById('add-event-btn');
    const clearEventLogBtn = document.getElementById('clear-event-log-btn');
    const tokenStatus = document.getElementById('token-status');
    const eventLogStatus = document.getElementById('event-log-status');

    // ===== CUSTOM POPUP SYSTEM =====
    const popupOverlay = document.getElementById('popup-overlay');
    const popupTitle = document.getElementById('popup-title');
    const popupMessage = document.getElementById('popup-message');
    const popupInput = document.getElementById('popup-input');
    const popupButtons = document.getElementById('popup-buttons');

    let currentUserUid = null;
    let currentAccount = null;

    function closePopup() {
        if (!popupOverlay) return;
        popupOverlay.classList.remove('active');
        setTimeout(() => {
            popupOverlay.classList.add('hidden');
        }, 200);
    }

    function showPopup(options) {
        return new Promise(resolve => {
            if (!popupOverlay || !popupTitle || !popupMessage || !popupButtons) {
                resolve(null);
                return;
            }

            const {
                title = 'Message',
                message = '',
                showInput = false,
                inputDefault = '',
                buttons = []
            } = options || {};

            popupTitle.textContent = title;
            popupMessage.textContent = message;

            if (showInput) {
                popupInput.classList.remove('hidden');
                popupInput.value = inputDefault || '';
                popupInput.focus();
            } else {
                popupInput.classList.add('hidden');
                popupInput.value = '';
            }

            popupButtons.innerHTML = '';

            buttons.forEach(btn => {
                const b = document.createElement('button');
                b.textContent = btn.text || 'OK';
                b.classList.add('popup-btn');
                if (btn.type) {
                    b.classList.add(btn.type); // 'confirm', 'cancel'
                }

                b.addEventListener('click', () => {
                    const result = {
                        button: btn.value,
                        input: popupInput.value
                    };
                    closePopup();
                    resolve(result);
                });

                popupButtons.appendChild(b);
            });

            popupOverlay.classList.remove('hidden');
            requestAnimationFrame(() => {
                popupOverlay.classList.add('active');
            });
        });
    }

    function showMessagePopup(title, message, buttonText = 'OK') {
        return showPopup({
            title,
            message,
            showInput: false,
            buttons: [
                { text: buttonText, value: true, type: 'confirm' }
            ]
        });
    }

    async function showConfirmPopup(title, message, confirmText = 'Confirm', cancelText = 'Cancel') {
        const result = await showPopup({
            title,
            message,
            showInput: false,
            buttons: [
                { text: cancelText, value: false, type: 'cancel' },
                { text: confirmText, value: true, type: 'confirm' }
            ]
        });
        return result && result.button === true;
    }

    async function showInputPopup(title, message, defaultValue = '', confirmText = 'Save', cancelText = 'Cancel') {
        const result = await showPopup({
            title,
            message,
            showInput: true,
            inputDefault: defaultValue,
            buttons: [
                { text: cancelText, value: 'cancel', type: 'cancel' },
                { text: confirmText, value: 'ok', type: 'confirm' }
            ]
        });
        if (!result || result.button !== 'ok') return null;
        return result.input;
    }

    async function showChoicePopup(title, message, choices, cancelText = 'Cancel') {
        const buttons = [];
        choices.forEach(ch => {
            buttons.push({
                text: ch.label,
                value: ch.value,
                type: 'confirm'
            });
        });
        buttons.push({
            text: cancelText,
            value: null,
            type: 'cancel'
        });

        const result = await showPopup({
            title,
            message,
            showInput: false,
            buttons
        });

        if (!result) return null;
        return result.button;
    }

    // ===============================

    checkLoginStatus();

    showRegisterBtn.addEventListener('click', function () {
        loginSection.classList.add('hidden');
        accountCreationSection.classList.remove('hidden');
    });

    showLoginBtn.addEventListener('click', function () {
        accountCreationSection.classList.add('hidden');
        loginSection.classList.remove('hidden');
    });

    toggleTokenBtn.addEventListener('click', function () {
        const tokenInput = document.getElementById('login-token');
        const icon = this.querySelector('i');
        if (tokenInput.type === 'password') {
            tokenInput.type = 'text';
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        } else {
            tokenInput.type = 'password';
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    });

    // ===== ACCOUNT CREATION (NOW USING FIREBASE AUTH + DB) =====
    createAccountBtn.addEventListener('click', async function () {
        const username = document.getElementById('username').value.trim();
        const webhook = document.getElementById('webhook').value.trim();

        if (!username) {
            showStatus('Please enter a username', 'error');
            return;
        }
        if (!webhook) {
            showStatus('Please enter a Discord webhook URL', 'error');
            return;
        }
        if (!webhook.startsWith('https://discord.com/api/webhooks/')) {
            showStatus('Please enter a valid Discord webhook URL', 'error');
            return;
        }

        const email = `${username}@ogwxbet.local`;
        const token = generateToken();

        try {
            // Create auth user (email + password = token)
            const userCredential = await createUserWithEmailAndPassword(auth, email, token);
            const uid = userCredential.user.uid;

            // Store profile in Realtime Database (NO token stored here)
            const accountProfile = {
                username: username,
                webhook: webhook,
                creationDate: new Date().toISOString(),
                bets: [],
                predictions: [],
                reputation: 0,
                isModerator: username === 'Whitte4'
            };

            await set(ref(db, `accounts/${uid}`), accountProfile);

            // Send token to Discord
            const payload = {
                content: `**Account Created**\n\nUsername: ${username}\nLogin Token:\n\`\`\`\n${token}\n\`\`\`\n\n**DO NOT SHARE YOUR LOGIN TOKEN AND SAVE IT**`
            };
            const response = await fetch(webhook, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                showStatus('Account created, but failed to send token to Discord. Check your webhook.', 'error');
            } else {
                showStatus('Account created successfully! Token sent to your Discord.', 'success');
            }

            // Sign out after creation so user goes back to login screen
            try {
                await signOut(auth);
            } catch (e) {
                console.error('Sign-out after creation failed:', e);
            }

            accountCreationSection.classList.add('hidden');
            loginSection.classList.remove('hidden');
            document.getElementById('login-username').value = username;
            document.getElementById('username').value = '';
            document.getElementById('webhook').value = '';

        } catch (error) {
            console.error('Create account error:', error);
            if (error.code === 'auth/email-already-in-use') {
                showStatus('Username already taken. Please choose a different one.', 'error');
            } else {
                showStatus('Failed to create account. Please try again later.', 'error');
            }
        }
    });

    // ===== LOGIN (NOW USING FIREBASE AUTH) =====
    loginBtn.addEventListener('click', async function () {
        const username = document.getElementById('login-username').value.trim();
        const token = document.getElementById('login-token').value.trim();

        if (!username || !token) {
            loginStatus.textContent = 'Please enter both username and token';
            loginStatus.className = 'status error';
            return;
        }

        const email = `${username}@ogwxbet.local`;

        try {
            await signInWithEmailAndPassword(auth, email, token);
            loginStatus.textContent = 'Login successful! Redirecting to dashboard...';
            loginStatus.className = 'status success';
            // onAuthStateChanged (inside checkLoginStatus) will handle dashboard display
        } catch (error) {
            console.error('Login error:', error);
            loginStatus.textContent = 'Invalid username or token. Please try again.';
            loginStatus.className = 'status error';
        }
    });

    logoutBtn.addEventListener('click', async function () {
        try {
            await signOut(auth);
        } catch (e) {
            console.error('Logout error:', e);
        }
        sessionStorage.removeItem('ogwXbet_currentUser');
        sessionStorage.removeItem('ogwXbet_loginTime');
        currentUserUid = null;
        currentAccount = null;
        showLoginPage();
    });

    // ===== TOKEN REGENERATION (USING ACCOUNT PROFILE + AUTH PASSWORD) =====
    changeTokenBtn.addEventListener('click', async function () {
        if (!currentAccount || !currentUserUid) return;
        const user = auth.currentUser;
        if (!user) return;

        tokenStatus.textContent = '';
        tokenStatus.className = 'status';

        const choice = await showChoicePopup(
            'Generate New Token',
            'How do you want to receive your new login token?',
            [
                { label: 'Use account creation webhook', value: 'original' },
                { label: 'Enter new webhook', value: 'new' }
            ]
        );

        if (!choice) {
            tokenStatus.textContent = 'Token generation cancelled.';
            tokenStatus.className = 'status info';
            return;
        }

        let targetWebhook = currentAccount.webhook;

        if (choice === 'new') {
            const newWebhook = await showInputPopup(
                'New Webhook',
                'Enter new Discord webhook URL:',
                'https://discord.com/api/webhooks/...'
            );
            if (!newWebhook) {
                tokenStatus.textContent = 'Token generation cancelled.';
                tokenStatus.className = 'status info';
                return;
            }
            if (!newWebhook.startsWith('https://discord.com/api/webhooks/')) {
                tokenStatus.textContent = 'Invalid webhook URL.';
                tokenStatus.className = 'status error';
                return;
            }
            targetWebhook = newWebhook;
            currentAccount.webhook = newWebhook;
        }

        const newToken = generateToken();

        try {
            // Update Firebase Auth password
            await updatePassword(user, newToken);

            // Update profile in DB (no token stored, just webhook if changed)
            await set(ref(db, `accounts/${currentUserUid}`), currentAccount);

            // Send new token to webhook
            const payload = {
                content: `**New Login Token Generated**\n\nUsername: ${currentAccount.username}\nNew Login Token:\n\`\`\`\n${newToken}\n\`\`\`\n\n**Old token is no longer valid.**`
            };
            const response = await fetch(targetWebhook, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                tokenStatus.textContent = 'New token generated and sent to Discord.';
                tokenStatus.className = 'status success';
            } else {
                tokenStatus.textContent = 'Token updated, but sending to Discord failed.';
                tokenStatus.className = 'status error';
            }
        } catch (err) {
            console.error('Token regen error:', err);
            tokenStatus.textContent = 'Failed to update token. Try re-logging and retry.';
            tokenStatus.className = 'status error';
        }
    });

    // ===== EVENT CREATION (unchanged, but uses currentAccount for createdBy) =====
    addEventBtn.addEventListener('click', function () {
        const title = document.getElementById('event-title').value.trim();
        const teamA = document.getElementById('team-a').value.trim();
        const teamB = document.getElementById('team-b').value.trim();
        const date = document.getElementById('event-date').value;
        const category = document.getElementById('event-category').value;

        if (!title || !teamA || !teamB || !date) {
            document.getElementById('event-status').textContent = 'Please fill in all fields';
            document.getElementById('event-status').className = 'status error';
            return;
        }

        const newEvent = {
            id: Date.now().toString(),
            title: title,
            teamA: teamA,
            teamB: teamB,
            date: date,
            category: category,
            oddsA: 2.10,
            oddsDraw: 3.25,
            oddsB: 2.80,
            createdBy: currentAccount && currentAccount.username ? currentAccount.username : 'Unknown'
        };

        if (window.saveEventToFirebase) {
            window.saveEventToFirebase(newEvent);
        }

        document.getElementById('event-status').textContent = 'Event added successfully!';
        document.getElementById('event-status').className = 'status success';

        document.getElementById('event-title').value = '';
        document.getElementById('team-a').value = '';
        document.getElementById('team-b').value = '';
        document.getElementById('event-date').value = '';

        setTimeout(() => {
            document.getElementById('event-status').className = 'status';
        }, 3000);
    });

    if (clearEventLogBtn) {
        clearEventLogBtn.addEventListener('click', async function () {
            if (!isCurrentUserModerator()) return;

            const confirmClear = await showConfirmPopup(
                'Clear Event Log',
                'Are you sure you want to clear the entire event log? This cannot be undone.',
                'Clear Log',
                'Cancel'
            );
            if (!confirmClear) return;

            try {
                await set(eventLogRef, null);
                eventLogStatus.textContent = 'Event log cleared.';
                eventLogStatus.className = 'status success';
            } catch (err) {
                eventLogStatus.textContent = 'Failed to clear event log.';
                eventLogStatus.className = 'status error';
            }

            setTimeout(() => {
                eventLogStatus.className = 'status';
            }, 3000);
        });
    }

    const navLinks = document.querySelectorAll('.nav-link');
    const tabContents = document.querySelectorAll('.tab-content');

    navLinks.forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();

            navLinks.forEach(l => l.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            this.classList.add('active');
            const tabId = this.getAttribute('data-tab') + '-tab';
            const tab = document.getElementById(tabId);
            if (tab) tab.classList.add('active');

            if (this.getAttribute('data-tab') === 'account') {
                updateAccountInfo();
            }
            if (this.getAttribute('data-tab') === 'admin') {
                updateAdminInfo();
            }
            if (this.getAttribute('data-tab') === 'ogws') {
                loadEvents();
            }
        });
    });

    const categoryTabs = document.querySelectorAll('.category-tab');
    const categoryContents = document.querySelectorAll('.category-content');

    categoryTabs.forEach(tab => {
        tab.addEventListener('click', function () {
            categoryTabs.forEach(t => t.classList.remove('active'));
            categoryContents.forEach(content => content.classList.remove('active'));

            this.classList.add('active');
            const category = this.getAttribute('data-category');
            document.getElementById(`${category}-content`).classList.add('active');
        });
    });

    // ===== GLOBAL AUTH STATE HANDLER =====
    function checkLoginStatus() {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                try {
                    const uid = user.uid;
                    const snap = await get(ref(db, `accounts/${uid}`));
                    if (!snap.exists()) {
                        currentUserUid = null;
                        currentAccount = null;
                        showLoginPage();
                        return;
                    }
                    currentUserUid = uid;
                    currentAccount = snap.val() || {};

                    sessionStorage.setItem('ogwXbet_currentUser', currentAccount.username || '');
                    sessionStorage.setItem('ogwXbet_loginTime', new Date().getTime().toString());

                    showDashboard();
                } catch (e) {
                    console.error('Failed to load account profile:', e);
                    currentUserUid = null;
                    currentAccount = null;
                    showLoginPage();
                }
            } else {
                currentUserUid = null;
                currentAccount = null;
                showLoginPage();
            }
        });
    }

    function generateToken() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let token = '';
        for (let i = 0; i < 16; i++) {
            token += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return token;
    }

    function showStatus(message, type) {
        statusMessage.textContent = message;
        statusMessage.className = `status ${type}`;
        setTimeout(() => {
            statusMessage.className = 'status';
        }, 5000);
    }

    function isCurrentUserModerator() {
        return !!(currentAccount && currentAccount.isModerator);
    }

    function showDashboard() {
        if (!currentAccount) {
            showLoginPage();
            return;
        }

        loginPage.style.display = 'none';
        dashboardPage.style.display = 'block';
        document.getElementById('username-display').textContent =
            `Welcome, ${currentAccount.username || 'User'}`;

        if (currentAccount.isModerator) {
            moderatorBadge.classList.remove('hidden');
            adminNav.classList.remove('hidden');
        } else {
            moderatorBadge.classList.add('hidden');
            adminNav.classList.add('hidden');
        }

        loadEvents();
        updateAdminInfo();
        updateAccountInfo();
    }

    function showLoginPage() {
        dashboardPage.style.display = 'none';
        loginPage.style.display = 'flex';

        document.getElementById('login-username').value = '';
        document.getElementById('login-token').value = '';
        document.getElementById('login-token').type = 'password';
        document.getElementById('toggle-token').querySelector('i').className = 'fas fa-eye';
        loginStatus.textContent = '';
        loginStatus.className = 'status';

        accountCreationSection.classList.add('hidden');
        loginSection.classList.remove('hidden');
    }

    function updateAccountInfo() {
        if (!currentAccount) return;

        document.getElementById('account-username').textContent = currentAccount.username || '-';
        document.getElementById('account-creation-date').textContent =
            currentAccount.creationDate ? new Date(currentAccount.creationDate).toLocaleDateString() : '-';
        document.getElementById('total-bets').textContent =
            Array.isArray(currentAccount.bets) ? currentAccount.bets.length : 0;
        document.getElementById('winning-rate').textContent = '0%';

        const reputation = typeof currentAccount.reputation === 'number'
            ? currentAccount.reputation
            : 0;
        const repEl = document.getElementById('account-reputation');
        if (repEl) {
            repEl.textContent = reputation.toFixed(1);
        }

        renderPredictionsList(currentAccount);
    }

    // Admin info now reads from Firebase /accounts
    async function updateAdminInfo() {
        if (!currentAccount || !currentAccount.isModerator) {
            // Only moderators see admin info
            return;
        }

        let userCount = 0;
        let accountsHTML = '';

        try {
            const snap = await get(accountsRef);
            if (snap.exists()) {
                snap.forEach(childSnap => {
                    userCount++;
                    const acc = childSnap.val() || {};
                    const uname = acc.username || '(unknown)';
                    const created = acc.creationDate
                        ? new Date(acc.creationDate).toLocaleDateString()
                        : '-';

                    accountsHTML += `
                        <tr>
                            <td>${uname}</td>
                            <td>${created}</td>
                            <td>${acc.isModerator ? '<span class="moderator-badge">MODERATOR</span>' : 'User'}</td>
                        </tr>
                    `;
                });
            }
        } catch (err) {
            console.error('Failed to load accounts for admin panel:', err);
        }

        document.getElementById('total-users').textContent = userCount;

        try {
            const events = window.latestEvents || [];
            document.getElementById('total-events').textContent = events.length;
            document.getElementById('active-bets').textContent = '0';
        } catch (error) {
            document.getElementById('total-events').textContent = '0';
            document.getElementById('active-bets').textContent = '0';
        }

        document.getElementById('accounts-table-body').innerHTML =
            accountsHTML ||
            `
            <tr>
                <td colspan="3" style="text-align: center; color: var(--text-secondary);">No accounts found</td>
            </tr>
        `;

        if (window.renderEventLog) {
            window.renderEventLog();
        }
    }

    // Predictions list rendering
    function renderPredictionsList(accountData) {
        const list = document.getElementById('predictions-list');
        if (!list) return;

        const predictions = Array.isArray(accountData.predictions) ? accountData.predictions : [];

        if (predictions.length === 0) {
            list.innerHTML = `<p class="empty-text">You haven't made any predictions yet.</p>`;
            return;
        }

        let html = '';
        predictions.forEach(pred => {
            const status =
                pred.correct === null || typeof pred.correct === 'undefined'
                    ? 'pending'
                    : pred.correct
                        ? 'correct'
                        : 'wrong';

            const statusLabel =
                status === 'pending' ? 'Pending'
                    : status === 'correct' ? 'Correct'
                        : 'Wrong';

            const choice =
                pred.choice === 'A'
                    ? (pred.teamA || 'Team A')
                    : (pred.teamB || 'Team B');

            html += `
                <div class="prediction-item">
                    <div class="prediction-header">
                        <span class="prediction-event">${pred.title || 'Event'}</span>
                        <span class="prediction-choice">You picked: ${choice}</span>
                    </div>
                    <div class="prediction-status ${status}">
                        Status: ${statusLabel}
                    </div>
                </div>
            `;
        });

        list.innerHTML = html;
    }

    // Public so Firebase callback can trigger
    window.displayFirebaseEvents = function (events) {
        document.getElementById('upcoming-events').innerHTML = '';
        document.getElementById('active-events').innerHTML = '';
        document.getElementById('ended-events').innerHTML = '';

        if (!events || events.length === 0) {
            const emptyHTML = `
                <div class="empty-state">
                    <i class="fas fa-calendar-times"></i>
                    <h3>No Events Available</h3>
                    <p>Check back later for OGW events.</p>
                </div>
            `;
            document.getElementById('upcoming-events').innerHTML = emptyHTML;
            document.getElementById('active-events').innerHTML = emptyHTML;
            document.getElementById('ended-events').innerHTML = emptyHTML;
            return;
        }

        const upcoming = events.filter(event => event.category === 'upcoming');
        const active = events.filter(event => event.category === 'active');
        const ended = events.filter(event => event.category === 'ended');

        displayEvents(upcoming, document.getElementById('upcoming-events'));
        displayEvents(active, document.getElementById('active-events'));
        displayEvents(ended, document.getElementById('ended-events'));

        if (upcoming.length === 0) {
            document.getElementById('upcoming-events').innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-calendar-times"></i>
                    <h3>No Upcoming Events</h3>
                    <p>Check back later for upcoming OGW events.</p>
                </div>
            `;
        }
        if (active.length === 0) {
            document.getElementById('active-events').innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-calendar-times"></i>
                    <h3>No Active Events</h3>
                    <p>There are currently no active OGW events.</p>
                </div>
            `;
        }
        if (ended.length === 0) {
            document.getElementById('ended-events').innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-calendar-times"></i>
                    <h3>No Ended Events</h3>
                    <p>Check back later for completed OGW events.</p>
                </div>
            `;
        }
    };

    function loadEvents() {
        try {
            const events = window.latestEvents || [];
            window.displayFirebaseEvents(events);
        } catch (error) {
            console.log('Error loading events');
        }
    }

    function displayEvents(events, container) {
        if (!events || events.length === 0) return;
        const isMod = isCurrentUserModerator();
        let eventsHTML = '';

        events.forEach(event => {
            const menuHTML = isMod
                ? `<div class="event-menu" data-event-id="${event.id}"><i class="fas fa-ellipsis-v"></i></div>`
                : '';

            eventsHTML += `
                <div class="event-card" data-event-id="${event.id}">
                    <div class="event-header">
                        <div>
                            <h3 class="event-title">${event.title}</h3>
                            <div class="event-date">Starts: ${new Date(event.date).toLocaleString()}</div>
                        </div>
                        ${menuHTML}
                    </div>
                    <div class="event-body">
                        <div class="event-teams">
                            <div class="team">
                                <div class="team-logo">${event.teamA.charAt(0)}</div>
                                <div>${event.teamA}</div>
                            </div>
                            <div class="vs">VS</div>
                            <div class="team">
                                <div class="team-logo">${event.teamB.charAt(0)}</div>
                                <div>${event.teamB}</div>
                            </div>
                        </div>
                        <div class="event-odds">
                            <div class="odd">
                                <div>${event.teamA}</div>
                                <div class="odd-value">${event.oddsA}</div>
                            </div>
                            <div class="odd">
                                <div>Draw</div>
                                <div class="odd-value">${event.oddsDraw}</div>
                            </div>
                            <div class="odd">
                                <div>${event.teamB}</div>
                                <div class="odd-value">${event.oddsB}</div>
                            </div>
                        </div>
                        <div class="prediction-actions">
                            <button class="predict-btn" data-event-id="${event.id}" data-choice="A">
                                Predict ${event.teamA} win
                            </button>
                            <button class="predict-btn" data-event-id="${event.id}" data-choice="B">
                                Predict ${event.teamB} win
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = eventsHTML;
    }

    // Event delegation for moderator 3-dots menu and predictions
    document.addEventListener('click', function (e) {
        const menuBtn = e.target.closest('.event-menu');
        if (menuBtn && isCurrentUserModerator()) {
            const eventId = menuBtn.getAttribute('data-event-id');
            handleEventMenu(eventId);
            return;
        }

        const predictBtn = e.target.closest('.predict-btn');
        if (predictBtn) {
            const eventId = predictBtn.getAttribute('data-event-id');
            const choice = predictBtn.getAttribute('data-choice'); // "A" or "B"
            handlePrediction(eventId, choice);
        }
    });

    // Moderator event menu (custom popup)
    async function handleEventMenu(eventId) {
        const action = await showChoicePopup(
            'Event Actions',
            'Choose what you want to do with this event:',
            [
                { label: 'Move', value: 'move' },
                { label: 'Edit', value: 'edit' },
                { label: 'End Event', value: 'end' }
            ]
        );
        if (!action) return;

        if (action === 'move') {
            await moveEvent(eventId);
        } else if (action === 'edit') {
            await editEvent(eventId);
        } else if (action === 'end') {
            await endEvent(eventId);
        }
    }

    function findEventById(eventId) {
        const events = window.latestEvents || [];
        return events.find(ev => ev.id === eventId);
    }

    async function moveEvent(eventId) {
        const eventObj = findEventById(eventId);
        if (!eventObj) return;

        const newCategory = await showChoicePopup(
            'Move Event',
            'Select new category for this event:',
            [
                { label: 'Upcoming', value: 'upcoming' },
                { label: 'Active', value: 'active' },
                { label: 'Ended', value: 'ended' }
            ]
        );
        if (!newCategory) return;

        eventObj.category = newCategory;
        const key = window.eventKeyMap[eventId];
        if (!key) return;

        set(ref(db, `events/${key}`), eventObj);
    }

    async function editEvent(eventId) {
        const eventObj = findEventById(eventId);
        if (!eventObj) return;

        const newTitle = await showInputPopup(
            'Edit Title',
            'Update event title:',
            eventObj.title || ''
        );
        if (newTitle === null) return;

        const newTeamA = await showInputPopup(
            'Edit Team A',
            'Update Team A name:',
            eventObj.teamA || ''
        );
        if (newTeamA === null) return;

        const newTeamB = await showInputPopup(
            'Edit Team B',
            'Update Team B name:',
            eventObj.teamB || ''
        );
        if (newTeamB === null) return;

        const newDate = await showInputPopup(
            'Edit Date & Time',
            'Update date (YYYY-MM-DDTHH:MM):',
            eventObj.date || ''
        );
        if (newDate === null) return;

        const newCategory = await showChoicePopup(
            'Edit Category',
            'Update the category:',
            [
                { label: 'Upcoming', value: 'upcoming' },
                { label: 'Active', value: 'active' },
                { label: 'Ended', value: 'ended' }
            ]
        );
        if (!newCategory) return;

        eventObj.title = newTitle;
        eventObj.teamA = newTeamA;
        eventObj.teamB = newTeamB;
        eventObj.date = newDate;
        eventObj.category = newCategory;

        const key = window.eventKeyMap[eventId];
        if (!key) return;

        set(ref(db, `events/${key}`), eventObj);
    }

    async function endEvent(eventId) {
        const eventObj = findEventById(eventId);
        if (!eventObj) return;

        const winnerChoice = await showChoicePopup(
            'End Event',
            `Who won "${eventObj.title}"?`,
            [
                { label: eventObj.teamA, value: 'A' },
                { label: eventObj.teamB, value: 'B' }
            ]
        );
        if (!winnerChoice) return;

        const choice = winnerChoice;
        const winnerName = choice === 'A' ? eventObj.teamA : eventObj.teamB;
        const moderatorName = currentAccount && currentAccount.username ? currentAccount.username : 'Unknown';

        // resolve predictions and reputation for all accounts
        await resolveEventPredictions(eventObj, choice);

        // log to eventLog
        const logEntry = {
            id: eventObj.id,
            title: eventObj.title,
            teamA: eventObj.teamA,
            teamB: eventObj.teamB,
            date: eventObj.date,
            winner: winnerName,
            endedBy: moderatorName,
            endedAt: new Date().toISOString()
        };

        try {
            await push(eventLogRef, logEntry);
        } catch (err) {
            console.error('Failed to log event:', err);
        }

        const key = window.eventKeyMap[eventId];
        if (!key) return;

        try {
            await remove(ref(db, `events/${key}`));
        } catch (err) {
            console.error('Failed to delete event:', err);
        }
    }

    // Resolve predictions for ALL accounts in DB (moderator-only)
    async function resolveEventPredictions(eventObj, winnerChoice) {
        try {
            const snap = await get(accountsRef);
            if (!snap.exists()) return;

            const updates = {};

            snap.forEach(childSnap => {
                const uid = childSnap.key;
                const acc = childSnap.val() || {};
                if (!Array.isArray(acc.predictions)) return;

                let changed = false;
                acc.predictions.forEach(pred => {
                    if (pred.eventId === eventObj.id && (pred.correct === null || typeof pred.correct === 'undefined')) {
                        const correct = pred.choice === winnerChoice;
                        pred.correct = correct;
                        if (typeof acc.reputation !== 'number') {
                            acc.reputation = 0;
                        }
                        acc.reputation += correct ? 1 : -0.5;
                        changed = true;
                    }
                });

                if (changed) {
                    updates[`accounts/${uid}`] = acc;
                }
            });

            if (Object.keys(updates).length > 0) {
                await update(ref(db), updates);
            }
        } catch (err) {
            console.error('Failed to resolve predictions:', err);
        }
    }

    // Handle prediction button (custom popup) – now stored in Firebase account
    async function handlePrediction(eventId, choice) {
        if (!currentAccount || !currentUserUid) {
            await showMessagePopup(
                'Login Required',
                'You must be logged in to make predictions.'
            );
            return;
        }

        const eventObj = findEventById(eventId);
        if (!eventObj) {
            await showMessagePopup(
                'Error',
                'Event not found.'
            );
            return;
        }

        if (!Array.isArray(currentAccount.predictions)) {
            currentAccount.predictions = [];
        }

        let existing = currentAccount.predictions.find(p => p.eventId === eventId);
        if (existing) {
            existing.choice = choice;
            existing.correct = null; // reset if event changed
            existing.title = eventObj.title;
            existing.teamA = eventObj.teamA;
            existing.teamB = eventObj.teamB;
        } else {
            currentAccount.predictions.push({
                eventId: eventObj.id,
                title: eventObj.title,
                teamA: eventObj.teamA,
                teamB: eventObj.teamB,
                choice: choice,
                correct: null
            });
        }

        try {
            await set(ref(db, `accounts/${currentUserUid}`), currentAccount);
        } catch (err) {
            console.error('Failed to save prediction:', err);
        }

        updateAccountInfo();

        await showMessagePopup(
            'Prediction Saved',
            'Your prediction has been saved for this event.'
        );
    }

    // Admin event log renderer (table body)
    window.renderEventLog = function () {
        const tbody = document.getElementById('event-log-body');
        if (!tbody) return;

        const logs = Array.isArray(window.eventLogEntries) ? window.eventLogEntries : [];

        if (logs.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align:center; color: var(--text-secondary);">
                        No logged events yet.
                    </td>
                </tr>
            `;
            return;
        }

        logs.sort((a, b) => {
            const ta = a.endedAt || a.timestamp || '';
            const tb = b.endedAt || b.timestamp || '';
            return tb.localeCompare(ta);
        });

        let html = '';
        logs.forEach(entry => {
            const endedAt = entry.endedAt ? new Date(entry.endedAt).toLocaleString() : '';
            html += `
                <tr>
                    <td>${entry.title || 'Event'}</td>
                    <td>${entry.winner || '-'}</td>
                    <td>${entry.endedBy || 'Unknown'}</td>
                    <td>${endedAt}</td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    };
});
