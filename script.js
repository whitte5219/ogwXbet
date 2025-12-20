// Firebase imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";

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
const userSearchRef = ref(db, "userSearch");

// NEW: chats + blocks
const announcementsMessagesRef = ref(db, "chats/announcements/messages");
const blocksRef = ref(db, "blocks");

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

    // ===== CHAT ELEMENTS (use FALLBACK selectors so it always works) =====
    const openChatBtn =
        document.getElementById('open-chat-btn') ||
        document.getElementById('chat-open-btn') ||
        document.querySelector('[data-open-chat="true"]') ||
        document.querySelector('.open-chat-btn');

    const chatOverlay =
        document.getElementById('chat-overlay') ||
        document.getElementById('chats-overlay') ||
        document.getElementById('chat-modal') ||
        document.querySelector('.chat-overlay') ||
        document.querySelector('.chats-overlay') ||
        document.querySelector('.chat-modal');

    // close button: we will also support delegation, but try direct binding too
    const closeChatBtn =
        document.getElementById('close-chat-btn') ||
        document.getElementById('chat-close-btn') ||
        (chatOverlay ? chatOverlay.querySelector('.chat-close') : null) ||
        (chatOverlay ? chatOverlay.querySelector('[data-close-chat="true"]') : null) ||
        (chatOverlay ? chatOverlay.querySelector('[data-action="close-chat"]') : null);

    const chatListEl = document.getElementById('chat-list') || document.querySelector('.chat-list');
    const chatSearchEl = document.getElementById('chat-search') || document.querySelector('.chat-search');
    const chatMessagesEl = document.getElementById('chat-messages') || document.querySelector('.chat-messages');
    const chatSelectedTitleEl = document.getElementById('chat-selected-title') || document.querySelector('.chat-selected-title');
    const chatSelectedSubtitleEl = document.getElementById('chat-selected-subtitle') || document.querySelector('.chat-selected-subtitle');
    const chatMessageInputEl = document.getElementById('chat-message-input') || document.querySelector('.chat-message-input');
    const sendChatMessageBtn = document.getElementById('send-chat-message-btn') || document.querySelector('.send-chat-message-btn');
    const chatStatusEl = document.getElementById('chat-status') || document.querySelector('.chat-status');

    // Optional admin sender (if exists)
    const announcementMessageEl = document.getElementById('announcement-message');
    const sendAnnouncementBtn = document.getElementById('send-announcement-btn');
    const announcementStatusEl = document.getElementById('announcement-status');

    // ===== CUSTOM POPUP SYSTEM =====
    const popupOverlay = document.getElementById('popup-overlay');
    const popupTitle = document.getElementById('popup-title');
    const popupMessage = document.getElementById('popup-message');
    const popupInput = document.getElementById('popup-input');
    const popupButtons = document.getElementById('popup-buttons');

    let currentUserUid = null;
    let currentAccount = null;

    // Chat state
    let announcementsUnsub = null;
    let isChatOpen = false;

    // ===== FIX: FORCE chat overlay hidden on load, in a way CSS can't override =====
    function forceHideChatOverlay() {
        if (!chatOverlay) return;
        chatOverlay.classList.add('hidden');
        chatOverlay.style.display = 'none';
        chatOverlay.style.pointerEvents = 'none';
        chatOverlay.setAttribute('aria-hidden', 'true');
        isChatOpen = false;
    }

    function forceShowChatOverlay() {
        if (!chatOverlay) return;
        chatOverlay.classList.remove('hidden');
        chatOverlay.style.display = 'flex';
        chatOverlay.style.pointerEvents = 'auto';
        chatOverlay.setAttribute('aria-hidden', 'false');
        isChatOpen = true;
    }

    forceHideChatOverlay();

    // ===== Bulletproof close (works even if ids/classes change) =====
    function closeChatOverlay() {
        // stop announcements listener
        if (typeof announcementsUnsub === 'function') {
            try { announcementsUnsub(); } catch (e) {}
        }
        announcementsUnsub = null;

        forceHideChatOverlay();
        if (chatSelectedTitleEl) chatSelectedTitleEl.textContent = 'Select a chat';
        if (chatSelectedSubtitleEl) chatSelectedSubtitleEl.textContent = '';
        if (chatMessagesEl) {
            chatMessagesEl.innerHTML = `
                <div class="chat-empty-state">
                    <i class="fas fa-comments"></i>
                    <h3>Select a chat</h3>
                    <p>Choose Announcements or a conversation.</p>
                </div>
            `;
        }
    }

    function openChatOverlay() {
        forceShowChatOverlay();
        renderPinnedAnnouncementsChat();
        selectAnnouncementsChat();
    }

    // Close via direct button if found
    if (closeChatBtn) {
        closeChatBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            closeChatOverlay();
        });
    }

    // Close via clicking the dark background (overlay itself)
    if (chatOverlay) {
        chatOverlay.addEventListener('mousedown', (e) => {
            if (e.target === chatOverlay) closeChatOverlay();
        });
    }

    // Close via ESC key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isChatOpen) {
            closeChatOverlay();
        }
    });

    // Close via event delegation (covers X button even if selector differs)
    document.addEventListener('click', (e) => {
        if (!isChatOpen) return;

        const closeHit =
            e.target.closest('#close-chat-btn') ||
            e.target.closest('#chat-close-btn') ||
            e.target.closest('.chat-close') ||
            e.target.closest('[data-close-chat="true"]') ||
            e.target.closest('[data-action="close-chat"]') ||
            e.target.closest('[data-modal-close="chat"]');

        if (closeHit) {
            e.preventDefault();
            closeChatOverlay();
        }
    });

    // Open button
    if (openChatBtn) {
        openChatBtn.addEventListener('click', (e) => {
            e.preventDefault();
            openChatOverlay();
        });
    }

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

            const { title = 'Message', message = '', showInput = false, inputDefault = '', buttons = [] } = options || {};

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
                if (btn.type) b.classList.add(btn.type);

                b.addEventListener('click', () => {
                    const result = { button: btn.value, input: popupInput.value };
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
            buttons: [{ text: buttonText, value: true, type: 'confirm' }]
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
            buttons.push({ text: ch.label, value: ch.value, type: 'confirm' });
        });
        buttons.push({ text: cancelText, value: null, type: 'cancel' });

        const result = await showPopup({ title, message, showInput: false, buttons });
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
                    result[field.name] = input ? input.value : '';
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

    // ===== USER PROFILE POPUP SYSTEM =====
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

        const showReputation = privacy.showReputation !== false;
        const showBets = privacy.showBets !== false;
        const showPredictions = privacy.showPredictions !== false;

        document.getElementById('profile-popup-username').textContent = userData.username || 'User Profile';

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

    if (showRegisterBtn) {
        showRegisterBtn.addEventListener('click', function () {
            loginSection.classList.add('hidden');
            accountCreationSection.classList.remove('hidden');
        });
    }

    if (showLoginBtn) {
        showLoginBtn.addEventListener('click', function () {
            accountCreationSection.classList.add('hidden');
            loginSection.classList.remove('hidden');
        });
    }

    if (toggleTokenBtn) {
        toggleTokenBtn.addEventListener('click', function () {
            const tokenInput = document.getElementById('login-token');
            const icon = this.querySelector('i');
            if (!tokenInput || !icon) return;

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
    }

    // ===== PHASE 1: NEW EVENT LISTENERS =====
    if (updatePictureBtn) updatePictureBtn.addEventListener('click', updateProfilePicture);
    if (saveProfileBtn) saveProfileBtn.addEventListener('click', saveProfileSettings);
    if (searchUserBtn) searchUserBtn.addEventListener('click', searchUsers);
    if (refreshPredictionsBtn) refreshPredictionsBtn.addEventListener('click', refreshAccountData);
    if (closeProfilePopup) closeProfilePopup.addEventListener('click', closeUserProfilePopup);

    if (userProfilePopup) {
        userProfilePopup.addEventListener('click', function (e) {
            if (e.target === userProfilePopup) closeUserProfilePopup();
        });
    }

    // ===== ACCOUNT CREATION (UPDATED WITH USERSEARCH SYNC) =====
    if (createAccountBtn) {
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
                const userCredential = await createUserWithEmailAndPassword(auth, email, token);
                const uid = userCredential.user.uid;

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
                    profile: {
                        picture: "",
                        bio: "",
                        privacy: {
                            showReputation: true,
                            showBets: true,
                            showPredictions: true,
                            showChats: true
                        }
                    }
                };

                await set(ref(db, `accounts/${uid}`), accountProfile);

                await set(ref(db, `userSearch/${uid}`), {
                    username: username,
                    creationDate: accountProfile.creationDate,
                    profile: accountProfile.profile
                });

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

                try { await signOut(auth); } catch (e) {}

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
    }
    // ===== LOGIN =====
    if (loginBtn) {
        loginBtn.addEventListener('click', async function () {
            const username = document.getElementById('login-username').value.trim();
            const token = document.getElementById('login-token').value.trim();

            if (!username || !token) {
                if (loginStatus) {
                    loginStatus.textContent = 'Please enter both username and token';
                    loginStatus.className = 'status error';
                }
                return;
            }

            const email = `${username}@ogwxbet.local`;

            try {
                await signInWithEmailAndPassword(auth, email, token);
                if (loginStatus) {
                    loginStatus.textContent = 'Login successful! Redirecting to dashboard...';
                    loginStatus.className = 'status success';
                }
            } catch (error) {
                console.error('Login error:', error);
                if (loginStatus) {
                    loginStatus.textContent = 'Invalid username or token. Please try again.';
                    loginStatus.className = 'status error';
                }
            }
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async function () {
            try { await signOut(auth); } catch (e) { console.error('Logout error:', e); }

            sessionStorage.removeItem('ogwXbet_currentUser');
            sessionStorage.removeItem('ogwXbet_loginTime');
            currentUserUid = null;
            currentAccount = null;

            // IMPORTANT: also force-hide chat overlay on logout
            forceHideChatOverlay();

            showLoginPage();
        });
    }

    // ===== TOKEN REGENERATION =====
    if (changeTokenBtn) {
        changeTokenBtn.addEventListener('click', async function () {
            if (!currentAccount || !currentUserUid) return;
            const user = auth.currentUser;
            if (!user) return;

            if (tokenStatus) {
                tokenStatus.textContent = '';
                tokenStatus.className = 'status';
            }

            const choice = await showChoicePopup(
                'Generate New Token',
                'How do you want to receive your new login token?',
                [
                    { label: 'Use account creation webhook', value: 'original' },
                    { label: 'Enter new webhook', value: 'new' }
                ]
            );

            if (!choice) {
                if (tokenStatus) {
                    tokenStatus.textContent = 'Token generation cancelled.';
                    tokenStatus.className = 'status info';
                }
                return;
            }

            let targetWebhook = currentAccount.webhook;

            if (choice === 'new') {
                const newWebhook = await showInputPopup(
                    'New Webhook',
                    'Enter new Discord webhook URL:',
                    'https://discord.com/api/webhooks/...'
                );
                if (!newWebhook) return;

                if (!newWebhook.startsWith('https://discord.com/api/webhooks/')) {
                    if (tokenStatus) {
                        tokenStatus.textContent = 'Invalid webhook URL.';
                        tokenStatus.className = 'status error';
                    }
                    return;
                }
                targetWebhook = newWebhook;
                currentAccount.webhook = newWebhook;
            }

            const newToken = generateToken();

            try {
                await updatePassword(user, newToken);
                await set(ref(db, `accounts/${currentUserUid}`), currentAccount);

                const payload = {
                    content: `**New Login Token Generated**\n\nUsername: ${currentAccount.username}\nNew Login Token:\n\`\`\`\n${newToken}\n\`\`\`\n\n**Old token is no longer valid.**`
                };
                const response = await fetch(targetWebhook, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (tokenStatus) {
                    if (response.ok) {
                        tokenStatus.textContent = 'New token generated and sent to Discord.';
                        tokenStatus.className = 'status success';
                    } else {
                        tokenStatus.textContent = 'Token updated, but sending to Discord failed.';
                        tokenStatus.className = 'status error';
                    }
                }
            } catch (err) {
                console.error('Token regen error:', err);
                if (tokenStatus) {
                    tokenStatus.textContent = 'Failed to update token. Try re-logging and retry.';
                    tokenStatus.className = 'status error';
                }
            }
        });
    }

    // ===== EVENT CREATION =====
    if (addEventBtn) {
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

            if (window.saveEventToFirebase) window.saveEventToFirebase(newEvent);

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
    }

    // ===== CLEAR EVENT LOG =====
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
                if (eventLogStatus) {
                    eventLogStatus.textContent = 'Event log cleared.';
                    eventLogStatus.className = 'status success';
                }
            } catch (err) {
                if (eventLogStatus) {
                    eventLogStatus.textContent = 'Failed to clear event log.';
                    eventLogStatus.className = 'status error';
                }
            }

            setTimeout(() => {
                if (eventLogStatus) eventLogStatus.className = 'status';
            }, 3000);
        });
    }

    // ===== NAV =====
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

            if (this.getAttribute('data-tab') === 'account') updateAccountInfo();
            if (this.getAttribute('data-tab') === 'admin') updateAdminInfo();
            if (this.getAttribute('data-tab') === 'ogws') loadEvents();
            if (this.getAttribute('data-tab') === 'community') {
                const grid = document.getElementById('users-grid');
                if (grid) {
                    grid.innerHTML = `
                        <div class="empty-state">
                            <i class="fas fa-users"></i>
                            <h3>Search for Users</h3>
                            <p>Use the search bar above to find other users on the platform.</p>
                        </div>
                    `;
                }
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

    // ===== AUTH HANDLER =====
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

                    // IMPORTANT: always start hidden after login
                    forceHideChatOverlay();

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
                forceHideChatOverlay();
                showLoginPage();
            }
        });
    }

    // ===== Announcements rendering =====
    function renderPinnedAnnouncementsChat() {
        if (!chatListEl) return;
        chatListEl.innerHTML = `
            <div class="chat-item pinned active" data-chat-id="announcements">
                <div class="chat-item-avatar"><i class="fas fa-shield-alt"></i></div>
                <div class="chat-item-body">
                    <div class="chat-item-title">Announcements</div>
                    <div class="chat-item-preview">Important updates</div>
                </div>
                <div class="chat-item-meta"></div>
            </div>
        `;

        const item = chatListEl.querySelector('[data-chat-id="announcements"]');
        if (item) {
            item.addEventListener('click', () => {
                selectAnnouncementsChat();
            });
        }
    }

    function selectAnnouncementsChat() {
        if (chatSelectedTitleEl) chatSelectedTitleEl.textContent = 'Announcements';
        if (chatSelectedSubtitleEl) chatSelectedSubtitleEl.textContent = isCurrentUserModerator() ? 'Moderator posting enabled' : 'Read-only for members';

        // Members can't type (if elements exist)
        if (chatMessageInputEl) {
            chatMessageInputEl.disabled = !isCurrentUserModerator();
            chatMessageInputEl.placeholder = isCurrentUserModerator() ? 'Post an announcement...' : 'Announcements are read-only';
        }
        if (sendChatMessageBtn) sendChatMessageBtn.disabled = !isCurrentUserModerator();

        if (typeof announcementsUnsub === 'function') {
            try { announcementsUnsub(); } catch (e) {}
        }

        announcementsUnsub = onValue(announcementsMessagesRef, (snap) => {
            const msgs = [];
            if (snap.exists()) {
                snap.forEach(child => {
                    const v = child.val() || {};
                    msgs.push({ _key: child.key, ...v });
                });
            }
            msgs.sort((a, b) => (a.ts || 0) - (b.ts || 0));

            if (!chatMessagesEl) return;

            if (msgs.length === 0) {
                chatMessagesEl.innerHTML = `
                    <div class="chat-empty-state">
                        <i class="fas fa-bullhorn"></i>
                        <h3>No announcements yet</h3>
                        <p>Important updates will appear here.</p>
                    </div>
                `;
                return;
            }

            let html = '';
            msgs.forEach(m => {
                const time = m.ts ? new Date(m.ts).toLocaleString() : '';
                html += `
                    <div class="chat-message-row theirs">
                        <div class="chat-message-avatar">
                            <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--accent);">
                                <i class="fas fa-shield-alt"></i>
                            </div>
                        </div>
                        <div class="chat-message-bubble">
                            <div class="chat-message-header">
                                <div class="chat-message-name">Announcements</div>
                                <div class="chat-message-time">${time}</div>
                            </div>
                            <div class="chat-message-text">${(m.text || '').replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
                        </div>
                    </div>
                `;
            });

            chatMessagesEl.innerHTML = html;
            setTimeout(() => {
                chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
            }, 30);
        });

        if (sendChatMessageBtn && !sendChatMessageBtn.dataset.bound) {
            sendChatMessageBtn.dataset.bound = "1";
            sendChatMessageBtn.addEventListener('click', async () => {
                if (!isCurrentUserModerator()) return;
                const text = (chatMessageInputEl ? chatMessageInputEl.value : '').trim();
                if (!text) return;

                try {
                    await push(announcementsMessagesRef, {
                        text,
                        ts: Date.now(),
                        postedByUid: currentUserUid,
                        postedBy: currentAccount?.username || 'Moderator'
                    });
                    if (chatMessageInputEl) chatMessageInputEl.value = '';
                } catch (err) {
                    console.error('Failed to post announcement:', err);
                    if (chatStatusEl) {
                        chatStatusEl.textContent = 'Failed to send.';
                        chatStatusEl.className = 'status error';
                        setTimeout(() => { chatStatusEl.className = 'status'; chatStatusEl.textContent = ''; }, 2500);
                    }
                }
            });
        }
    }

    // ===== Helpers / existing functions (unchanged) =====
    function generateToken() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let token = '';
        for (let i = 0; i < 16; i++) {
            token += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return token;
    }

    function showStatus(message, type) {
        if (!statusMessage) return;
        statusMessage.textContent = message;
        statusMessage.className = `status ${type}`;
        setTimeout(() => {
            statusMessage.className = 'status';
        }, 5000);
    }

    function isCurrentUserModerator() {
        return !!(currentAccount && currentAccount.isModerator);
    }

    // NOTE:
    // Everything else from your original script continues below (events, admin, predictions, etc.)
    // I did not remove any working systems — only added the chat close fix + announcements wiring.
});
