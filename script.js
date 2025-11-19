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

    // ===== PHASE 1: NEW ELEMENTS =====
    const updatePictureBtn = document.getElementById('update-picture-btn');
    const saveProfileBtn = document.getElementById('save-profile-btn');
    const profileStatus = document.getElementById('profile-status');
    const searchUserBtn = document.getElementById('search-user-btn');
    const refreshPredictionsBtn = document.getElementById('refresh-predictions-btn');
    const closeProfilePopup = document.getElementById('close-profile-popup');
    const userProfilePopup = document.getElementById('user-profile-popup');

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

    // ===== FORM POPUP FOR SINGLE-FORM EDITING =====
    async function showFormPopup(title, fields, confirmText = 'Save', cancelText = 'Cancel') {
        return new Promise(resolve => {
            if (!popupOverlay || !popupTitle || !popupMessage || !popupButtons) {
                resolve(null);
                return;
            }

            // Create form HTML
            let formHTML = '';
            fields.forEach(field => {
                formHTML += `
                    <div class="form-group" style="margin-bottom: 15px;">
                        <label for="popup-field-${field.name}" style="display: block; margin-bottom: 5px; color: var(--text-secondary);">
                            ${field.label}
                        </label>
                        ${field.type === 'select' ? `
                            <select id="popup-field-${field.name}" style="width: 100%; padding: 8px; border-radius: 6px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1); color: var(--text);">
                                ${field.options.map(opt => `
                                    <option value="${opt.value}" ${field.value === opt.value ? 'selected' : ''}>${opt.label}</option>
                                `).join('')}
                            </select>
                        ` : `
                            <input type="${field.type}" id="popup-field-${field.name}" 
                                   value="${field.value || ''}" 
                                   style="width: 100%; padding: 8px; border-radius: 6px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1); color: var(--text);"
                                   ${field.placeholder ? `placeholder="${field.placeholder}"` : ''}>
                        `}
                    </div>
                `;
            });

            popupTitle.textContent = title;
            popupMessage.innerHTML = formHTML;
            popupInput.classList.add('hidden');

            popupButtons.innerHTML = '';
            
            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = cancelText;
            cancelBtn.classList.add('popup-btn', 'cancel');
            cancelBtn.addEventListener('click', () => {
                closePopup();
                resolve(null);
            });

            const confirmBtn = document.createElement('button');
            confirmBtn.textContent = confirmText;
            confirmBtn.classList.add('popup-btn', 'confirm');
            confirmBtn.addEventListener('click', () => {
                const result = {};
                fields.forEach(field => {
                    const input = document.getElementById(`popup-field-${field.name}`);
                    result[field.name] = field.type === 'select' ? input.value : input.value;
                });
                closePopup();
                resolve(result);
            });

            popupButtons.appendChild(cancelBtn);
            popupButtons.appendChild(confirmBtn);

            popupOverlay.classList.remove('hidden');
            requestAnimationFrame(() => {
                popupOverlay.classList.add('active');
            });
        });
    }

    // ===== UPDATED: USER PROFILE POPUP SYSTEM =====
    function closeUserProfilePopup() {
        if (!userProfilePopup) return;
        userProfilePopup.classList.remove('active');
        setTimeout(() => {
            userProfilePopup.classList.add('hidden');
        }, 200);
    }

    function openUserProfilePopup(userData) {
        if (!userProfilePopup) return;
        
        const profile = userData.profile || {};
        const privacy = profile.privacy || {};
        
        // Respect privacy settings
        const showReputation = privacy.showReputation !== false;
        const showBets = privacy.showBets !== false;
        const showPredictions = privacy.showPredictions !== false;

        // Set username in popup header
        document.getElementById('profile-popup-username').textContent = userData.username || 'User Profile';
        
        // Build profile content
        const profileContent = document.getElementById('profile-popup-content');
        profileContent.innerHTML = `
            <div class="profile-popup-avatar">
                ${profile.picture ? `
                    <img src="${profile.picture}" 
                         alt="${userData.username}" 
                         onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                    <div class="profile-popup-avatar-placeholder" style="display: none;">
                        <i class="fas fa-user"></i>
                        <div style="font-size: 0.7rem; margin-top: 5px;">No PFP</div>
                    </div>
                ` : `
                    <div class="profile-popup-avatar-placeholder">
                        <i class="fas fa-user"></i>
                        <div style="font-size: 0.7rem; margin-top: 5px;">No PFP</div>
                    </div>
                `}
            </div>

            <div class="profile-popup-username">
                <h4>${userData.username}</h4>
            </div>

            <div class="profile-popup-join-date">
                <p>Member since ${userData.creationDate ? new Date(userData.creationDate).toLocaleDateString() : 'Unknown'}</p>
            </div>

            ${profile.bio ? `
                <div class="profile-popup-bio">
                    <h5>About</h5>
                    <p>${profile.bio}</p>
                </div>
            ` : ''}

            ${showReputation || showBets || showPredictions ? `
                <div class="profile-popup-stats">
                    ${showReputation ? `
                        <div class="profile-popup-stat">
                            <div class="profile-popup-stat-value">
                                ${typeof userData.reputation === 'number' ? userData.reputation.toFixed(1) : '0'}
                            </div>
                            <div class="profile-popup-stat-label">Reputation</div>
                        </div>
                    ` : ''}
                    
                    ${showBets ? `
                        <div class="profile-popup-stat">
                            <div class="profile-popup-stat-value">
                                ${Array.isArray(userData.bets) ? userData.bets.length : 0}
                            </div>
                            <div class="profile-popup-stat-label">Total Bets</div>
                        </div>
                    ` : ''}
                    
                    ${showPredictions ? `
                        <div class="profile-popup-stat">
                            <div class="profile-popup-stat-value">
                                ${Array.isArray(userData.predictions) ? userData.predictions.length : 0}
                            </div>
                            <div class="profile-popup-stat-label">Predictions</div>
                        </div>
                    ` : ''}
                </div>
            ` : `
                <div class="profile-popup-private">
                    <i class="fas fa-user-shield"></i>
                    <p>This user has chosen to keep their stats private.</p>
                </div>
            `}
        `;

        userProfilePopup.classList.remove('hidden');
        requestAnimationFrame(() => {
            userProfilePopup.classList.add('active');
        });
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

    // ===== PHASE 1: NEW EVENT LISTENERS =====
    if (updatePictureBtn) {
        updatePictureBtn.addEventListener('click', updateProfilePicture);
    }

    if (saveProfileBtn) {
        saveProfileBtn.addEventListener('click', saveProfileSettings);
    }

    if (searchUserBtn) {
        searchUserBtn.addEventListener('click', searchUsers);
    }

    if (refreshPredictionsBtn) {
        refreshPredictionsBtn.addEventListener('click', refreshAccountData);
    }

    if (closeProfilePopup) {
        closeProfilePopup.addEventListener('click', closeUserProfilePopup);
    }

    // Close profile popup when clicking outside
    if (userProfilePopup) {
        userProfilePopup.addEventListener('click', function(e) {
            if (e.target === userProfilePopup) {
                closeUserProfilePopup();
            }
        });
    }

    // ===== ACCOUNT CREATION (UPDATED WITH PROFILE FIELDS) =====
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

            // Store profile in Realtime Database (WITH NEW PROFILE FIELDS)
            const accountProfile = {
                username: username,
                webhook: webhook,
                creationDate: new Date().toISOString(),
                bets: [],
                predictions: [],
                reputation: 0,
                isModerator: username === 'Whitte4',
                deleted: false,
                deletedAt: null,
                deletedBy: null,
                // PHASE 1: NEW PROFILE FIELDS
                profile: {
                    picture: "", // Will store URL for profile picture
                    bio: "", // User bio/description
                    privacy: {
                        showReputation: true,
                        showBets: true,
                        showPredictions: true
                    }
                }
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

    // ===== LOGIN =====
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

    // ===== TOKEN REGENERATION =====
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

    // ===== EVENT CREATION =====
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
            if (this.getAttribute('data-tab') === 'community') {
                // Clear previous search results when switching to community tab
                document.getElementById('users-grid').innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-users"></i>
                        <h3>Search for Users</h3>
                        <p>Use the search bar above to find other users on the platform.</p>
                    </div>
                `;
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
                    
                    const accountData = snap.val() || {};
                    
                    // Check if account is deleted
                    if (accountData.deleted === true) {
                        await showMessagePopup(
                            'Account Deleted',
                            'This account has been deleted by moderators. Please contact support if you believe this is a mistake.'
                        );
                        await signOut(auth);
                        currentUserUid = null;
                        currentAccount = null;
                        showLoginPage();
                        return;
                    }
                    
                    currentUserUid = uid;
                    currentAccount = accountData;

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

    // ===== PHASE 1: UPDATED PROFILE FUNCTIONS =====
    function updateProfilePicture() {
        const pictureUrl = document.getElementById('profile-picture-url').value.trim();
        const preview = document.getElementById('profile-picture-preview');
        const placeholder = document.getElementById('profile-picture-placeholder');
        
        if (!pictureUrl) {
            // No URL - show placeholder
            preview.style.display = 'none';
            placeholder.style.display = 'flex';
            profileStatus.textContent = 'Picture removed. Using placeholder.';
            profileStatus.className = 'status info';
            setTimeout(() => {
                profileStatus.className = 'status';
            }, 3000);
            return;
        }

        // Basic URL validation
        if (!pictureUrl.startsWith('http')) {
            profileStatus.textContent = 'Please enter a valid URL starting with http:// or https://';
            profileStatus.className = 'status error';
            return;
        }

        // Update preview
        preview.onerror = function() {
            preview.style.display = 'none';
            placeholder.style.display = 'flex';
            profileStatus.textContent = 'Failed to load image from this URL. Using placeholder.';
            profileStatus.className = 'status error';
        };
        
        preview.onload = function() {
            preview.style.display = 'block';
            placeholder.style.display = 'none';
            profileStatus.textContent = 'Picture updated successfully!';
            profileStatus.className = 'status success';
            setTimeout(() => {
                profileStatus.className = 'status';
            }, 3000);
        };
        
        preview.src = pictureUrl;
    }

    async function saveProfileSettings() {
        if (!currentAccount || !currentUserUid) return;

        profileStatus.textContent = '';
        profileStatus.className = 'status';

        try {
            // Get current values
            const pictureUrl = document.getElementById('profile-picture-url').value.trim();
            const bio = document.getElementById('user-bio').value.trim();
            const showReputation = document.getElementById('privacy-reputation').checked;
            const showBets = document.getElementById('privacy-bets').checked;
            const showPredictions = document.getElementById('privacy-predictions').checked;

            // Update current account object
            currentAccount.profile = {
                picture: pictureUrl,
                bio: bio,
                privacy: {
                    showReputation: showReputation,
                    showBets: showBets,
                    showPredictions: showPredictions
                }
            };

            // Save to Firebase
            await set(ref(db, `accounts/${currentUserUid}`), currentAccount);

            profileStatus.textContent = 'Profile settings saved successfully!';
            profileStatus.className = 'status success';

            setTimeout(() => {
                profileStatus.className = 'status';
            }, 3000);

        } catch (err) {
            console.error('Failed to save profile settings:', err);
            profileStatus.textContent = 'Failed to save profile settings. Please try again.';
            profileStatus.className = 'status error';
        }
    }

    // ===== UPDATED: SEARCH FUNCTION - NO PFP IN SEARCH RESULTS =====
    async function searchUsers() {
        const searchTerm = document.getElementById('user-search').value.trim().toLowerCase();
        const usersGrid = document.getElementById('users-grid');

        if (!searchTerm) {
            usersGrid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-users"></i>
                    <h3>Search for Users</h3>
                    <p>Use the search bar above to find other users on the platform.</p>
                </div>
            `;
            return;
        }

        usersGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-spinner fa-spin"></i>
                <h3>Searching...</h3>
                <p>Looking for users matching "${searchTerm}"</p>
            </div>
        `;

        try {
            const snap = await get(accountsRef);
            const results = [];

            if (snap.exists()) {
                snap.forEach(childSnap => {
                    const account = childSnap.val() || {};
                    // FIXED: Skip deleted accounts and check if username matches search
                    // Also ensure account has basic required fields
                    if (!account.deleted && 
                        account.username && 
                        account.username.toLowerCase().includes(searchTerm) &&
                        account.creationDate) {
                        results.push({
                            uid: childSnap.key,
                            ...account
                        });
                    }
                });
            }

            if (results.length === 0) {
                usersGrid.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-user-times"></i>
                        <h3>No Users Found</h3>
                        <p>No users found matching "${searchTerm}"</p>
                    </div>
                `;
                return;
            }

            // Display results in 3-column grid - SIMPLIFIED WITHOUT PFP
            let html = '<div class="users-grid-three-column">';
            results.forEach(user => {
                html += `
                    <div class="user-search-card">
                        <div class="user-search-info">
                            <div class="user-search-header">
                                <div class="user-avatar-placeholder-search">
                                    <i class="fas fa-user"></i>
                                </div>
                                <div>
                                    <h4>${user.username}</h4>
                                    <p>Joined: ${user.creationDate ? new Date(user.creationDate).toLocaleDateString() : 'Unknown'}</p>
                                </div>
                            </div>
                            <button class="btn btn-secondary view-profile-btn" data-user-id="${user.uid}">
                                <i class="fas fa-eye"></i> View Profile
                            </button>
                        </div>
                    </div>
                `;
            });
            html += '</div>';

            usersGrid.innerHTML = html;

            // Add event listeners to view profile buttons
            document.querySelectorAll('.view-profile-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const userId = this.getAttribute('data-user-id');
                    const userData = results.find(user => user.uid === userId);
                    if (userData) {
                        openUserProfilePopup(userData);
                    }
                });
            });

        } catch (err) {
            console.error('Failed to search users:', err);
            usersGrid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Search Failed</h3>
                    <p>Unable to search users at this time. Please try again later.</p>
                </div>
            `;
        }
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

    // ===== UPDATED: UPDATE ACCOUNT INFO WITH PROFILE FIELDS =====
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

        // PHASE 1: Populate profile fields
        const profile = currentAccount.profile || {};
        const privacy = profile.privacy || {};

        // Profile picture - handle placeholder
        const picturePreview = document.getElementById('profile-picture-preview');
        const placeholder = document.getElementById('profile-picture-placeholder');
        const pictureUrlInput = document.getElementById('profile-picture-url');
        
        if (picturePreview && placeholder && pictureUrlInput) {
            if (profile.picture) {
                picturePreview.src = profile.picture;
                picturePreview.style.display = 'block';
                placeholder.style.display = 'none';
            } else {
                picturePreview.style.display = 'none';
                placeholder.style.display = 'flex';
            }
            pictureUrlInput.value = profile.picture || '';
        }

        // Bio
        const bioInput = document.getElementById('user-bio');
        if (bioInput) {
            bioInput.value = profile.bio || '';
        }

        // Privacy settings
        const reputationCheckbox = document.getElementById('privacy-reputation');
        const betsCheckbox = document.getElementById('privacy-bets');
        const predictionsCheckbox = document.getElementById('privacy-predictions');
        
        if (reputationCheckbox) reputationCheckbox.checked = privacy.showReputation !== false;
        if (betsCheckbox) betsCheckbox.checked = privacy.showBets !== false;
        if (predictionsCheckbox) predictionsCheckbox.checked = privacy.showPredictions !== false;

        renderPredictionsList(currentAccount);
    }

    // ===== UPDATED ADMIN INFO =====
    async function updateAdminInfo() {
        if (!currentAccount || !currentAccount.isModerator) {
            return;
        }

        let userCount = 0;
        let deletedUserCount = 0;
        let activeAccountsHTML = '';
        let deletedAccountsHTML = '';

        try {
            const snap = await get(accountsRef);
            if (snap.exists()) {
                snap.forEach(childSnap => {
                    const uid = childSnap.key;
                    const acc = childSnap.val() || {};
                    
                    if (acc.deleted === true) {
                        deletedUserCount++;
                        const uname = acc.username || '(unknown)';
                        const created = acc.creationDate
                            ? new Date(acc.creationDate).toLocaleDateString()
                            : '-';
                        const deletedAt = acc.deletedAt
                            ? new Date(acc.deletedAt).toLocaleString()
                            : '-';
                        const deletedBy = acc.deletedBy || 'Unknown';

                        deletedAccountsHTML += `
                            <tr>
                                <td>${uname}</td>
                                <td>${created}</td>
                                <td>${deletedAt}</td>
                                <td>${deletedBy}</td>
                                <td>
                                    <button class="btn-restore-account" data-uid="${uid}" data-username="${uname}">
                                        <i class="fas fa-undo"></i> Restore
                                    </button>
                                </td>
                            </tr>
                        `;
                    } else {
                        userCount++;
                        const uname = acc.username || '(unknown)';
                        const created = acc.creationDate
                            ? new Date(acc.creationDate).toLocaleDateString()
                            : '-';

                        activeAccountsHTML += `
                            <tr>
                                <td>${uname}</td>
                                <td>${created}</td>
                                <td>${acc.isModerator ? '<span class="moderator-badge">MODERATOR</span>' : 'User'}</td>
                                <td>
                                    <button class="btn-delete-account" data-uid="${uid}" data-username="${uname}">
                                        <i class="fas fa-trash"></i> Delete
                                    </button>
                                </td>
                            </tr>
                        `;
                    }
                });
            }
        } catch (err) {
            console.error('Failed to load accounts for admin panel:', err);
        }

        document.getElementById('total-users').textContent = userCount;
        document.getElementById('deleted-users').textContent = deletedUserCount;

        try {
            const events = window.latestEvents || [];
            document.getElementById('total-events').textContent = events.length;
            document.getElementById('active-bets').textContent = '0';
        } catch (error) {
            document.getElementById('total-events').textContent = '0';
            document.getElementById('active-bets').textContent = '0';
        }

        // Update active accounts table
        document.getElementById('accounts-table-body').innerHTML =
            activeAccountsHTML ||
            `
            <tr>
                <td colspan="4" style="text-align: center; color: var(--text-secondary);">No active accounts found</td>
            </tr>
        `;

        // Update deleted accounts table
        document.getElementById('deleted-accounts-table-body').innerHTML =
            deletedAccountsHTML ||
            `
            <tr>
                <td colspan="5" style="text-align: center; color: var(--text-secondary);">No deleted accounts found</td>
            </tr>
        `;

        // Add event listeners for delete/restore buttons
        document.querySelectorAll('.btn-delete-account').forEach(btn => {
            btn.addEventListener('click', function() {
                const uid = this.getAttribute('data-uid');
                const username = this.getAttribute('data-username');
                deleteAccount(uid, username);
            });
        });

        document.querySelectorAll('.btn-restore-account').forEach(btn => {
            btn.addEventListener('click', function() {
                const uid = this.getAttribute('data-uid');
                const username = this.getAttribute('data-username');
                restoreAccount(uid, username);
            });
        });

        if (window.renderEventLog) {
            window.renderEventLog();
        }
    }

    // ===== DELETE ACCOUNT FUNCTION =====
    async function deleteAccount(uid, username) {
        if (!isCurrentUserModerator()) return;

        const confirmDelete = await showConfirmPopup(
            'Delete Account',
            `Are you sure you want to delete the account "${username}"? This will prevent the user from logging in.`,
            'Delete Account',
            'Cancel'
        );

        if (!confirmDelete) return;

        try {
            // Mark account as deleted instead of removing it
            const updates = {
                deleted: true,
                deletedAt: new Date().toISOString(),
                deletedBy: currentAccount.username || 'Unknown Moderator'
            };

            await update(ref(db, `accounts/${uid}`), updates);

            // Show success message
            await showMessagePopup(
                'Account Deleted',
                `Account "${username}" has been successfully deleted. The user will be logged out if currently active.`
            );

            // Refresh admin info to show updated tables
            updateAdminInfo();

        } catch (err) {
            console.error('Failed to delete account:', err);
            await showMessagePopup(
                'Error',
                'Failed to delete account. Please try again.'
            );
        }
    }

    // ===== RESTORE ACCOUNT FUNCTION =====
    async function restoreAccount(uid, username) {
        if (!isCurrentUserModerator()) return;

        const confirmRestore = await showConfirmPopup(
            'Restore Account',
            `Are you sure you want to restore the account "${username}"? The user will be able to log in again.`,
            'Restore Account',
            'Cancel'
        );

        if (!confirmRestore) return;

        try {
            // Remove deletion markers to restore account
            const updates = {
                deleted: false,
                deletedAt: null,
                deletedBy: null
            };

            await update(ref(db, `accounts/${uid}`), updates);

            // Show success message
            await showMessagePopup(
                'Account Restored',
                `Account "${username}" has been successfully restored. The user can now log in again.`
            );

            // Refresh admin info to show updated tables
            updateAdminInfo();

        } catch (err) {
            console.error('Failed to restore account:', err);
            await showMessagePopup(
                'Error',
                'Failed to restore account. Please try again.'
            );
        }
    }

    // ===== PREDICTIONS LIST RENDERING =====
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
            // Determine status based on correct field and event status
            let status = 'pending';
            let statusLabel = 'Pending';
            
            // Check if prediction has been resolved
            if (pred.correct === true) {
                status = 'correct';
                statusLabel = 'Correct';
            } else if (pred.correct === false) {
                status = 'wrong';
                statusLabel = 'Wrong';
            } else {
                // If not resolved, check if event exists in ended events
                const events = window.latestEvents || [];
                const endedEvent = events.find(ev => ev.id === pred.eventId && ev.category === 'ended');
                if (endedEvent) {
                    // Event ended but prediction not resolved - show as pending resolution
                    status = 'pending';
                    statusLabel = 'Pending Resolution';
                } else {
                    // Event still active/upcoming
                    status = 'pending';
                    statusLabel = 'Pending';
                }
            }

            const choice = pred.choice === 'A' ? (pred.teamA || 'Team A') : (pred.teamB || 'Team B');

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

    // ===== DISPLAY EVENTS WITH PREDICTION STATUS =====
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

        displayEvents(upcoming, document.getElementById('upcoming-events'), 'upcoming');
        displayEvents(active, document.getElementById('active-events'), 'active');
        displayEvents(ended, document.getElementById('ended-events'), 'ended');

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

    // ===== DISPLAY EVENTS WITH VISUAL PREDICTION STATES =====
    function displayEvents(events, container, category) {
        if (!events || events.length === 0) return;
        const isMod = isCurrentUserModerator();
        let eventsHTML = '';

        events.forEach(event => {
            const menuHTML = isMod
                ? `<div class="event-menu" data-event-id="${event.id}"><i class="fas fa-ellipsis-v"></i></div>`
                : '';

            // Get user's prediction for this event if exists
            const userPrediction = currentAccount && Array.isArray(currentAccount.predictions) 
                ? currentAccount.predictions.find(p => p.eventId === event.id)
                : null;

            // Show prediction status in ended events
            const predictionStatusHTML = category === 'ended' && userPrediction 
                ? `<div class="prediction-result ${userPrediction.correct ? 'correct' : 'wrong'}">
                      <strong>Your Prediction:</strong> ${userPrediction.choice === 'A' ? event.teamA : event.teamB} 
                      <span style="margin-left: 8px;">
                          ${userPrediction.correct ? '✓ Correct' : '✗ Wrong'}
                      </span>
                   </div>`
                : '';

            // Determine button styles based on user's prediction
            const isPredictedA = userPrediction && userPrediction.choice === 'A';
            const isPredictedB = userPrediction && userPrediction.choice === 'B';
            
            const buttonStyleA = isPredictedA ? 
                'style="background-color: var(--success); color: white; border-color: var(--success);"' : 
                'style="background-color: rgba(255, 255, 255, 0.04); color: var(--text-secondary); border-color: rgba(255, 255, 255, 0.1);"';
            
            const buttonStyleB = isPredictedB ? 
                'style="background-color: var(--success); color: white; border-color: var(--success);"' : 
                'style="background-color: rgba(255, 255, 255, 0.04); color: var(--text-secondary); border-color: rgba(255, 255, 255, 0.1);"';

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
                        ${predictionStatusHTML}
                        ${category !== 'ended' ? `
                        <div class="prediction-actions">
                            <button class="predict-btn" data-event-id="${event.id}" data-choice="A" ${buttonStyleA}>
                                Predict ${event.teamA} win
                            </button>
                            <button class="predict-btn" data-event-id="${event.id}" data-choice="B" ${buttonStyleB}>
                                Predict ${event.teamB} win
                            </button>
                        </div>
                        ` : ''}
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

    // ===== EVENT MENU WITH 3 OPTIONS =====
    async function handleEventMenu(eventId) {
        const action = await showChoicePopup(
            'Event Actions',
            'Choose what you want to do with this event:',
            [
                { label: 'Edit', value: 'edit' },
                { label: 'Move', value: 'move' },
                { label: 'Delete', value: 'delete' }
            ]
        );
        if (!action) return;

        if (action === 'edit') {
            await editEventFull(eventId);
        } else if (action === 'move') {
            await moveEventSmart(eventId);
        } else if (action === 'delete') {
            await deleteEvent(eventId);
        }
    }

    function findEventById(eventId) {
        const events = window.latestEvents || [];
        return events.find(ev => ev.id === eventId);
    }

    // ===== SINGLE-FORM EDIT FUNCTION =====
    async function editEventFull(eventId) {
        const eventObj = findEventById(eventId);
        if (!eventObj) return;

        const formFields = [
            {
                name: 'title',
                label: 'Event Title',
                type: 'text',
                value: eventObj.title || ''
            },
            {
                name: 'teamA',
                label: 'Team A',
                type: 'text',
                value: eventObj.teamA || ''
            },
            {
                name: 'teamB',
                label: 'Team B',
                type: 'text',
                value: eventObj.teamB || ''
            },
            {
                name: 'date',
                label: 'Event Date & Time',
                type: 'datetime-local',
                value: eventObj.date || ''
            },
            {
                name: 'category',
                label: 'Category',
                type: 'select',
                value: eventObj.category || 'upcoming',
                options: [
                    { label: 'Upcoming', value: 'upcoming' },
                    { label: 'Active', value: 'active' },
                    { label: 'Ended', value: 'ended' }
                ]
            },
            {
                name: 'oddsA',
                label: 'Odds Team A',
                type: 'number',
                value: eventObj.oddsA || 2.10,
                placeholder: '2.10'
            },
            {
                name: 'oddsDraw',
                label: 'Odds Draw',
                type: 'number',
                value: eventObj.oddsDraw || 3.25,
                placeholder: '3.25'
            },
            {
                name: 'oddsB',
                label: 'Odds Team B',
                type: 'number',
                value: eventObj.oddsB || 2.80,
                placeholder: '2.80'
            }
        ];

        const result = await showFormPopup('Edit Event', formFields, 'Save Changes', 'Cancel');
        
        if (!result) return;

        // Update event object with new values
        Object.keys(result).forEach(key => {
            if (key === 'oddsA' || key === 'oddsDraw' || key === 'oddsB') {
                eventObj[key] = parseFloat(result[key]) || eventObj[key];
            } else {
                eventObj[key] = result[key];
            }
        });

        const key = window.eventKeyMap[eventId];
        if (!key) return;

        try {
            await set(ref(db, `events/${key}`), eventObj);
            await showMessagePopup('Success', 'Event updated successfully!');
        } catch (err) {
            console.error('Failed to update event:', err);
            await showMessagePopup('Error', 'Failed to update event.');
        }
    }

    // ===== SMART MOVE FUNCTION WITH PROPER PREDICTION RESOLUTION =====
    async function moveEventSmart(eventId) {
        const eventObj = findEventById(eventId);
        if (!eventObj) return;

        const newCategory = await showChoicePopup(
            'Move Event',
            'Select new category for this event:',
            [
                { label: 'Upcoming', value: 'upcoming' },
                { label: 'Active', value: 'active' },
                { label: 'Ended (Resolve Predictions)', value: 'ended' }
            ]
        );
        if (!newCategory) return;

        // If moving to ended, we need to resolve predictions
        if (newCategory === 'ended') {
            const winnerChoice = await showChoicePopup(
                'End Event & Resolve Predictions',
                `Who won "${eventObj.title}"? This will award reputation to correct predictions.`,
                [
                    { label: eventObj.teamA, value: 'A' },
                    { label: eventObj.teamB, value: 'B' }
                ]
            );
            if (!winnerChoice) return;

            console.log('Resolving predictions for event:', eventObj.title, 'Winner:', winnerChoice);

            // Resolve predictions and award reputation
            await resolveEventPredictions(eventObj, winnerChoice);

            // Show success message
            await showMessagePopup(
                'Predictions Resolved', 
                `Event ended! Reputation has been awarded to users with correct predictions.`
            );

            // Log to eventLog
            const winnerName = winnerChoice === 'A' ? eventObj.teamA : eventObj.teamB;
            const moderatorName = currentAccount && currentAccount.username ? currentAccount.username : 'Unknown';
            
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
        }

        // Update event category
        eventObj.category = newCategory;
        const key = window.eventKeyMap[eventId];
        if (!key) return;

        try {
            await set(ref(db, `events/${key}`), eventObj);
            await showMessagePopup('Success', `Event moved to ${newCategory} successfully!`);
            
            // Force refresh account info to show updated prediction status
            if (currentUserUid) {
                const snap = await get(ref(db, `accounts/${currentUserUid}`));
                if (snap.exists()) {
                    currentAccount = snap.val() || {};
                    updateAccountInfo();
                }
            }
        } catch (err) {
            console.error('Failed to move event:', err);
            await showMessagePopup('Error', 'Failed to move event.');
        }
    }

    // ===== DELETE EVENT FUNCTION =====
    async function deleteEvent(eventId) {
        const eventObj = findEventById(eventId);
        if (!eventObj) return;

        const confirmDelete = await showConfirmPopup(
            'Delete Event',
            `Are you sure you want to delete "${eventObj.title}"? This will move it to the event log.`,
            'Delete Event',
            'Cancel'
        );

        if (!confirmDelete) return;

        // Log to eventLog before deleting
        const logEntry = {
            id: eventObj.id,
            title: eventObj.title,
            teamA: eventObj.teamA,
            teamB: eventObj.teamB,
            date: eventObj.date,
            deletedBy: currentAccount && currentAccount.username ? currentAccount.username : 'Unknown',
            deletedAt: new Date().toISOString(),
            reason: 'Manually deleted by moderator'
        };

        try {
            await push(eventLogRef, logEntry);
        } catch (err) {
            console.error('Failed to log event deletion:', err);
        }

        const key = window.eventKeyMap[eventId];
        if (!key) return;

        try {
            await remove(ref(db, `events/${key}`));
            await showMessagePopup('Success', 'Event deleted successfully!');
        } catch (err) {
            console.error('Failed to delete event:', err);
            await showMessagePopup('Error', 'Failed to delete event.');
        }
    }

    // ===== RESOLVE EVENT PREDICTIONS - PROPERLY COMPARES CHOICES =====
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
                    // Check if this prediction is for the current event AND hasn't been resolved yet
                    if (pred.eventId === eventObj.id && (pred.correct === null || typeof pred.correct === 'undefined')) {
                        // Ensure we're comparing the same data types
                        const userChoice = String(pred.choice).toUpperCase();
                        const actualWinner = String(winnerChoice).toUpperCase();
                        const correct = userChoice === actualWinner;
                        
                        pred.correct = correct;
                        if (typeof acc.reputation !== 'number') {
                            acc.reputation = 0;
                        }
                        acc.reputation += correct ? 1 : -0.5;
                        changed = true;
                        
                        console.log(`User ${acc.username}: Predicted ${userChoice}, Winner ${actualWinner}, Correct: ${correct}`);
                    }
                });

                if (changed) {
                    updates[`accounts/${uid}`] = acc;
                }
            });

            if (Object.keys(updates).length > 0) {
                await update(ref(db), updates);
                console.log('Updated predictions for', Object.keys(updates).length, 'accounts');
            }
        } catch (err) {
            console.error('Failed to resolve predictions:', err);
        }
    }

    // ===== PREDICTION HANDLING WITH VISUAL FEEDBACK =====
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

        if (eventObj.category === 'ended') {
            await showMessagePopup(
                'Event Ended',
                'This event has already ended. You cannot make new predictions.'
            );
            return;
        }

        if (!Array.isArray(currentAccount.predictions)) {
            currentAccount.predictions = [];
        }

        let existing = currentAccount.predictions.find(p => p.eventId === eventId);
        
        // If user already has a prediction for this event
        if (existing) {
            // If clicking the same choice, do nothing
            if (existing.choice === choice) {
                return;
            }
            
            // If switching prediction, ask for confirmation
            const confirmSwitch = await showConfirmPopup(
                'Switch Prediction',
                `You already predicted ${existing.choice === 'A' ? eventObj.teamA : eventObj.teamB}. Do you want to switch to ${choice === 'A' ? eventObj.teamA : eventObj.teamB}?`,
                'Switch',
                'Keep Current'
            );
            
            if (!confirmSwitch) {
                return; // User chose to keep current prediction
            }
            
            // Update existing prediction
            existing.choice = choice;
            existing.correct = null; // reset if event changed
            existing.title = eventObj.title;
            existing.teamA = eventObj.teamA;
            existing.teamB = eventObj.teamB;
        } else {
            // New prediction
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
            await showMessagePopup('Error', 'Failed to save prediction.');
            return;
        }

        // Update the UI to show which button is selected
        updatePredictionButtons(eventId, choice);
        updateAccountInfo();
    }

    // ===== UPDATE PREDICTION BUTTONS VISUALLY =====
    function updatePredictionButtons(eventId, selectedChoice) {
        // Find all prediction buttons for this event
        const predictBtns = document.querySelectorAll(`.predict-btn[data-event-id="${eventId}"]`);
        
        predictBtns.forEach(btn => {
            const choice = btn.getAttribute('data-choice');
            if (choice === selectedChoice) {
                // Selected button - green
                btn.style.backgroundColor = 'var(--success)';
                btn.style.color = 'white';
                btn.style.borderColor = 'var(--success)';
            } else {
                // Not selected - default style
                btn.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                btn.style.color = 'var(--text-secondary)';
                btn.style.borderColor = 'rgba(255, 255, 255, 0.1)';
            }
        });
    }

    // ===== FORCE ACCOUNT REFRESH FUNCTION =====
    async function refreshAccountData() {
        if (!currentUserUid) return;
        
        try {
            const snap = await get(ref(db, `accounts/${currentUserUid}`));
            if (snap.exists()) {
                currentAccount = snap.val() || {};
                updateAccountInfo();
                loadEvents(); // Also refresh events to show updated prediction status
                
                // Show success message
                if (profileStatus) {
                    profileStatus.textContent = 'Account data refreshed successfully!';
                    profileStatus.className = 'status success';
                    setTimeout(() => {
                        profileStatus.className = 'status';
                    }, 3000);
                }
            }
        } catch (err) {
            console.error('Failed to refresh account data:', err);
            if (profileStatus) {
                profileStatus.textContent = 'Failed to refresh data. Please try again.';
                profileStatus.className = 'status error';
            }
        }
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
