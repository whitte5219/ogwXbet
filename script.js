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

// NEW: Chat + blocking nodes (allowed by your confirmation)
const chatsDmRef = ref(db, "chats/dm");
const chatsUserThreadsRef = ref(db, "chats/userThreads");
const announcementsRef = ref(db, "chats/announcements");
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

    // ===== PHASE 1: COMMUNITY ELEMENTS =====
    const updatePictureBtn = document.getElementById('update-picture-btn');
    const saveProfileBtn = document.getElementById('save-profile-btn');
    const profileStatus = document.getElementById('profile-status');
    const searchUserBtn = document.getElementById('search-user-btn');
    const refreshPredictionsBtn = document.getElementById('refresh-predictions-btn');
    const closeProfilePopup = document.getElementById('close-profile-popup');
    const userProfilePopup = document.getElementById('user-profile-popup');

    // ===== NEW: ANNOUNCEMENTS ADMIN ELEMENTS =====
    const announcementMessageEl = document.getElementById('announcement-message');
    const sendAnnouncementBtn = document.getElementById('send-announcement-btn');
    const announcementStatusEl = document.getElementById('announcement-status');

    // ===== NEW: CHAT ELEMENTS =====
    const openChatBtn = document.getElementById('open-chat-btn');
    const chatOverlay = document.getElementById('chat-overlay');
    const closeChatBtn = document.getElementById('close-chat-btn');
    const chatListEl = document.getElementById('chat-list');
    const chatSearchEl = document.getElementById('chat-search');
    const chatMessagesEl = document.getElementById('chat-messages');
    const chatEmptyStateEl = document.getElementById('chat-empty-state');
    const chatSelectedTitleEl = document.getElementById('chat-selected-title');
    const chatSelectedSubtitleEl = document.getElementById('chat-selected-subtitle');
    const chatMessageInputEl = document.getElementById('chat-message-input');
    const sendChatMessageBtn = document.getElementById('send-chat-message-btn');
    const chatStatusEl = document.getElementById('chat-status');
    const viewChatProfileBtn = document.getElementById('view-chat-profile-btn');
    const blockChatUserBtn = document.getElementById('block-chat-user-btn');

    // ===== CUSTOM POPUP SYSTEM =====
    const popupOverlay = document.getElementById('popup-overlay');
    const popupTitle = document.getElementById('popup-title');
    const popupMessage = document.getElementById('popup-message');
    const popupInput = document.getElementById('popup-input');
    const popupButtons = document.getElementById('popup-buttons');

    let currentUserUid = null;
    let currentAccount = null;

    // Live listeners that must be cleaned up
    let liveAccountUnsub = null;
    let liveThreadsUnsub = null;
    let liveMessagesUnsub = null;

    // Chat state
    let currentChat = null; // { type: 'announcements' } OR { type:'dm', threadId, otherUid, otherUsername, otherProfile }
    let cachedUserSearch = {}; // uid -> userSearch data (for fast profile opening)
    let cachedBlocksAll = null; // blocks snapshot cache during searches
    let myBlockedSet = new Set(); // uids I blocked (from blocks/<me>)

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
                    b.classList.add(btn.type);
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
                                   value="${field.value ?? ''}"
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

    function normalizePrivacy(profilePrivacy) {
        const p = profilePrivacy || {};
        return {
            showReputation: p.showReputation !== false,
            showBets: p.showBets !== false,
            showPredictions: p.showPredictions !== false,
            showChats: p.showChats !== false
        };
    }

    async function openUserProfilePopup(userData) {
        if (!userProfilePopup) return;

        const uid = userData.uid;
        const profile = userData.profile || {};
        const privacy = normalizePrivacy((profile && profile.privacy) || {});
        const isSelf = currentUserUid && uid === currentUserUid;

        // Block states
        const iBlocked = !!(currentUserUid && uid && (await get(ref(db, `blocks/${currentUserUid}/${uid}`))).exists());
        const theyBlockedMe = !!(currentUserUid && uid && (await get(ref(db, `blocks/${uid}/${currentUserUid}`))).exists());

        // If they blocked me, this profile should normally never be reachable (search hides it),
        // but handle gracefully.
        if (theyBlockedMe) {
            await showMessagePopup('Profile Unavailable', 'You cannot view this profile.');
            return;
        }

        // Set username in popup header
        const headerEl = document.getElementById('profile-popup-username');
        if (headerEl) headerEl.textContent = userData.username || 'User Profile';

        const profileContent = document.getElementById('profile-popup-content');
        if (!profileContent) return;

        const createdLabel = userData.creationDate ? new Date(userData.creationDate).toLocaleDateString() : 'Unknown';
        const repValue = typeof userData.reputation === 'number' ? userData.reputation : 0;
        const betsCount = Array.isArray(userData.bets) ? userData.bets.length : 0;
        const predsCount = Array.isArray(userData.predictions) ? userData.predictions.length : 0;

        const showStats = (privacy.showReputation || privacy.showBets || privacy.showPredictions);

        // Buttons logic
        const canChatWithTarget = !isSelf && privacy.showChats && !iBlocked;
        const chatBtnDisabledReason = isSelf
            ? 'This is your profile.'
            : (!privacy.showChats ? 'This user disabled chat requests.' : (iBlocked ? 'You blocked this user.' : ''));

        profileContent.innerHTML = `
            <div class="profile-popup-top">
                <div class="profile-popup-avatar">
                    ${profile.picture ? `<img src="${profile.picture}" alt="${userData.username}" onerror="this.style.display='none';">` : ''}
                </div>
                <div class="profile-popup-identity">
                    <div class="name">${userData.username || 'User'}</div>
                    <div class="meta">Member since ${createdLabel}</div>
                    <div class="profile-popup-badges">
                        ${userData.isModerator ? `<span class="profile-badge mod"><i class="fas fa-shield-alt"></i> MODERATOR</span>` : ''}
                        ${iBlocked ? `<span class="profile-badge"><i class="fas fa-ban"></i> You blocked this user</span>` : ''}
                    </div>
                </div>
            </div>

            ${profile.bio ? `<div class="profile-popup-bio">${escapeHtml(profile.bio)}</div>` : ''}

            ${showStats ? `
                <div class="profile-popup-stats">
                    ${privacy.showReputation ? `
                        <div class="profile-stat">
                            <div class="value">${Number(repValue).toFixed(1)}</div>
                            <div class="label">Reputation</div>
                        </div>
                    ` : ''}
                    ${privacy.showBets ? `
                        <div class="profile-stat">
                            <div class="value">${betsCount}</div>
                            <div class="label">Total Bets</div>
                        </div>
                    ` : ''}
                    ${privacy.showPredictions ? `
                        <div class="profile-stat">
                            <div class="value">${predsCount}</div>
                            <div class="label">Predictions</div>
                        </div>
                    ` : ''}
                </div>
            ` : `
                <div class="profile-popup-note">
                    <i class="fas fa-user-shield"></i> This user keeps stats private.
                </div>
            `}

            <div class="profile-popup-actions">
                <button class="btn ${canChatWithTarget ? '' : 'btn-secondary'}" id="profile-chat-btn" ${canChatWithTarget ? '' : 'disabled'}>
                    <i class="fas fa-comments"></i> Chat
                </button>
                ${!isSelf ? `
                    <button class="btn ${iBlocked ? 'btn-secondary' : 'btn-danger'}" id="profile-block-btn">
                        <i class="fas ${iBlocked ? 'fa-unlock' : 'fa-ban'}"></i> ${iBlocked ? 'Unblock' : 'Block'}
                    </button>
                ` : `
                    <button class="btn btn-secondary" disabled title="You can't block yourself">
                        <i class="fas fa-ban"></i> Block
                    </button>
                `}
            </div>

            ${(!canChatWithTarget && chatBtnDisabledReason) ? `<div class="profile-popup-note">${escapeHtml(chatBtnDisabledReason)}</div>` : ''}
        `;

        // Bind buttons
        const chatBtn = document.getElementById('profile-chat-btn');
        if (chatBtn) {
            chatBtn.addEventListener('click', async () => {
                if (!canChatWithTarget) return;
                await startOrOpenDm(uid, userData);
                closeUserProfilePopup();
            });
        }

        const blockBtn = document.getElementById('profile-block-btn');
        if (blockBtn && !isSelf) {
            blockBtn.addEventListener('click', async () => {
                if (iBlocked) {
                    await unblockUser(uid, userData.username || 'User');
                } else {
                    await blockUser(uid, userData.username || 'User');
                }
                // Refresh popup state (simple: close and reopen)
                closeUserProfilePopup();
                setTimeout(() => openUserProfilePopup(userData), 50);
            });
        }

        userProfilePopup.classList.remove('hidden');
        requestAnimationFrame(() => {
            userProfilePopup.classList.add('active');
        });
    }

    function escapeHtml(str) {
        if (typeof str !== 'string') return '';
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
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

    // ===== PHASE 1: COMMUNITY EVENT LISTENERS =====
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

    // ===== NEW: ANNOUNCEMENT SENDER (mods only) =====
    if (sendAnnouncementBtn) {
        sendAnnouncementBtn.addEventListener('click', async () => {
            if (!isCurrentUserModerator()) {
                setStatus(announcementStatusEl, 'Only moderators can send announcements.', 'error', 3000);
                return;
            }
            const text = (announcementMessageEl ? announcementMessageEl.value : '').trim();
            if (!text) {
                setStatus(announcementStatusEl, 'Please type an announcement.', 'error', 2500);
                return;
            }

            const ok = await showConfirmPopup(
                'Send Announcement',
                'Send this message to the global Announcements chat?',
                'Send',
                'Cancel'
            );
            if (!ok) return;

            try {
                const msg = {
                    text,
                    ts: Date.now(),
                    postedByUid: currentUserUid,
                    postedBy: (currentAccount && currentAccount.username) ? currentAccount.username : 'Moderator'
                };
                await push(ref(db, 'chats/announcements/messages'), msg);
                if (announcementMessageEl) announcementMessageEl.value = '';
                setStatus(announcementStatusEl, 'Announcement sent.', 'success', 2500);
            } catch (err) {
                console.error('Failed to send announcement:', err);
                setStatus(announcementStatusEl, 'Failed to send announcement.', 'error', 3000);
            }
        });
    }

    // ===== NEW: CHAT UI EVENT LISTENERS =====
    if (openChatBtn) {
        openChatBtn.addEventListener('click', () => {
            openChatOverlay();
        });
    }

    if (closeChatBtn) {
        closeChatBtn.addEventListener('click', () => {
            closeChatOverlay();
        });
    }

    if (chatOverlay) {
        chatOverlay.addEventListener('click', (e) => {
            if (e.target === chatOverlay) closeChatOverlay();
        });
    }

    if (chatSearchEl) {
        chatSearchEl.addEventListener('input', () => {
            renderChatListFromCache();
        });
    }

    if (sendChatMessageBtn) {
        sendChatMessageBtn.addEventListener('click', async () => {
            await sendCurrentChatMessage();
        });
    }

    if (chatMessageInputEl) {
        chatMessageInputEl.addEventListener('keydown', async (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                await sendCurrentChatMessage();
            }
        });
    }

    if (viewChatProfileBtn) {
        viewChatProfileBtn.addEventListener('click', async () => {
            if (!currentChat || currentChat.type !== 'dm') return;
            const uid = currentChat.otherUid;
            const userData = await getUserSearchByUid(uid);
            if (userData) {
                await openUserProfilePopup(userData);
            } else {
                await showMessagePopup('Not Found', 'User profile could not be loaded.');
            }
        });
    }

    if (blockChatUserBtn) {
        blockChatUserBtn.addEventListener('click', async () => {
            if (!currentChat || currentChat.type !== 'dm') return;
            const uid = currentChat.otherUid;
            const uname = currentChat.otherUsername || 'User';

            const iBlocked = !!(currentUserUid && uid && (await get(ref(db, `blocks/${currentUserUid}/${uid}`))).exists());
            if (iBlocked) {
                await unblockUser(uid, uname);
            } else {
                await blockUser(uid, uname);
            }
        });
    }

    // ===== ACCOUNT CREATION (UPDATED WITH USERSEARCH SYNC + chats privacy default) =====
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
            await doLogoutToLogin();
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
                if (!newWebhook) {
                    if (tokenStatus) {
                        tokenStatus.textContent = 'Token generation cancelled.';
                        tokenStatus.className = 'status info';
                    }
                    return;
                }
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
                const st = document.getElementById('event-status');
                if (st) {
                    st.textContent = 'Please fill in all fields';
                    st.className = 'status error';
                }
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

            const st = document.getElementById('event-status');
            if (st) {
                st.textContent = 'Event added successfully!';
                st.className = 'status success';
            }

            document.getElementById('event-title').value = '';
            document.getElementById('team-a').value = '';
            document.getElementById('team-b').value = '';
            document.getElementById('event-date').value = '';

            setTimeout(() => {
                const st2 = document.getElementById('event-status');
                if (st2) st2.className = 'status';
            }, 3000);
        });
    }

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
            const el = document.getElementById(`${category}-content`);
            if (el) el.classList.add('active');
        });
    });

    // ===== GLOBAL AUTH STATE HANDLER (with live account updates + deleted enforcement) =====
    function checkLoginStatus() {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                try {
                    const uid = user.uid;

                    // Stop old live listener first
                    if (typeof liveAccountUnsub === 'function') {
                        try { liveAccountUnsub(); } catch (e) {}
                        liveAccountUnsub = null;
                    }

                    const snap = await get(ref(db, `accounts/${uid}`));
                    if (!snap.exists()) {
                        currentUserUid = null;
                        currentAccount = null;
                        showLoginPage();
                        return;
                    }

                    const accountData = snap.val() || {};

                    // Check deleted immediately
                    if (accountData.deleted === true) {
                        await showMessagePopup(
                            'Account Deleted',
                            'This account has been deleted by moderators. Please contact support if you believe this is a mistake.'
                        );
                        await safeSignOut();
                        currentUserUid = null;
                        currentAccount = null;
                        showLoginPage();
                        return;
                    }

                    currentUserUid = uid;
                    currentAccount = accountData;

                    sessionStorage.setItem('ogwXbet_currentUser', currentAccount.username || '');
                    sessionStorage.setItem('ogwXbet_loginTime', new Date().getTime().toString());

                    // Live account listener: force logout immediately if deleted while online
                    liveAccountUnsub = onValue(ref(db, `accounts/${uid}`), async (s) => {
                        if (!s.exists()) return;
                        const acc = s.val() || {};
                        currentAccount = acc;

                        // Deleted -> force logout
                        if (acc.deleted === true) {
                            await showMessagePopup(
                                'Account Deleted',
                                'Your account was deleted by moderators.'
                            );
                            await doLogoutToLogin(true);
                            return;
                        }

                        // Keep userSearch in sync if profile changed (best-effort)
                        if (currentUserUid && currentAccount) {
                            try {
                                await initializeUserSearch();
                            } catch (e) {}
                        }

                        // Update UI bits if needed
                        try {
                            updateAccountInfo();
                        } catch (e) {}
                    });

                    showDashboard();

                } catch (e) {
                    console.error('Failed to load account profile:', e);
                    currentUserUid = null;
                    currentAccount = null;
                    showLoginPage();
                }
            } else {
                // Logged out
                if (typeof liveAccountUnsub === 'function') {
                    try { liveAccountUnsub(); } catch (e) {}
                    liveAccountUnsub = null;
                }
                if (typeof liveThreadsUnsub === 'function') {
                    try { liveThreadsUnsub(); } catch (e) {}
                    liveThreadsUnsub = null;
                }
                if (typeof liveMessagesUnsub === 'function') {
                    try { liveMessagesUnsub(); } catch (e) {}
                    liveMessagesUnsub = null;
                }

                currentUserUid = null;
                currentAccount = null;
                showLoginPage();
            }
        });
    }

    async function safeSignOut() {
        try { await signOut(auth); } catch (e) {}
    }

    async function doLogoutToLogin(skipPopup) {
        try {
            await safeSignOut();
        } catch (e) {
            console.error('Logout error:', e);
        }
        sessionStorage.removeItem('ogwXbet_currentUser');
        sessionStorage.removeItem('ogwXbet_loginTime');

        currentUserUid = null;
        currentAccount = null;

        // Cleanup live listeners
        if (typeof liveAccountUnsub === 'function') {
            try { liveAccountUnsub(); } catch (e) {}
            liveAccountUnsub = null;
        }
        stopThreadsListener();
        stopMessagesListener();

        // Close chat overlay too
        try { closeChatOverlay(); } catch (e) {}

        if (!skipPopup) {
            // no popup
        }

        showLoginPage();
    }

    // ===== INITIALIZE USER SEARCH DATA =====
    async function initializeUserSearch() {
        if (!currentUserUid || !currentAccount) return;

        try {
            const profile = currentAccount.profile || {};
            const privacy = normalizePrivacy((profile && profile.privacy) || {});
            // ensure stored privacy includes showChats
            const mergedProfile = {
                picture: profile.picture || "",
                bio: profile.bio || "",
                privacy: {
                    showReputation: privacy.showReputation,
                    showBets: privacy.showBets,
                    showPredictions: privacy.showPredictions,
                    showChats: privacy.showChats
                }
            };

            const payload = {
                username: currentAccount.username,
                creationDate: currentAccount.creationDate,
                profile: mergedProfile
            };

            const searchSnap = await get(ref(db, `userSearch/${currentUserUid}`));
            if (!searchSnap.exists()) {
                await set(ref(db, `userSearch/${currentUserUid}`), payload);
            } else {
                const existing = searchSnap.val() || {};
                const existingStr = JSON.stringify(existing || {});
                const payloadStr = JSON.stringify(payload || {});
                if (existingStr !== payloadStr) {
                    await set(ref(db, `userSearch/${currentUserUid}`), payload);
                }
            }
        } catch (err) {
            console.error('Failed to initialize user search data:', err);
        }
    }

    // ===== PROFILE FUNCTIONS =====
    function updateProfilePicture() {
        const pictureUrl = document.getElementById('profile-picture-url').value.trim();
        const preview = document.getElementById('profile-picture-preview');
        const placeholder = document.getElementById('profile-picture-placeholder');

        if (!preview || !placeholder || !profileStatus) return;

        if (!pictureUrl) {
            preview.style.display = 'none';
            placeholder.style.display = 'flex';
            profileStatus.textContent = 'Picture removed. Using placeholder.';
            profileStatus.className = 'status info';
            setTimeout(() => {
                profileStatus.className = 'status';
            }, 3000);
            return;
        }

        if (!pictureUrl.startsWith('http')) {
            profileStatus.textContent = 'Please enter a valid URL starting with http:// or https://';
            profileStatus.className = 'status error';
            return;
        }

        preview.onerror = function () {
            preview.style.display = 'none';
            placeholder.style.display = 'flex';
            profileStatus.textContent = 'Failed to load image from this URL. Using placeholder.';
            profileStatus.className = 'status error';
        };

        preview.onload = function () {
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

    // ===== SAVE PROFILE SETTINGS (includes chat privacy) =====
    async function saveProfileSettings() {
        if (!currentAccount || !currentUserUid) return;

        if (profileStatus) {
            profileStatus.textContent = '';
            profileStatus.className = 'status';
        }

        try {
            const pictureUrl = document.getElementById('profile-picture-url').value.trim();
            const bio = document.getElementById('user-bio').value.trim();

            const showReputation = document.getElementById('privacy-reputation')?.checked ?? true;
            const showBets = document.getElementById('privacy-bets')?.checked ?? true;
            const showPredictions = document.getElementById('privacy-predictions')?.checked ?? true;
            const showChats = document.getElementById('privacy-chats')?.checked ?? true;

            currentAccount.profile = {
                picture: pictureUrl,
                bio: bio,
                privacy: {
                    showReputation,
                    showBets,
                    showPredictions,
                    showChats
                }
            };

            await set(ref(db, `accounts/${currentUserUid}`), currentAccount);

            await set(ref(db, `userSearch/${currentUserUid}`), {
                username: currentAccount.username,
                creationDate: currentAccount.creationDate,
                profile: currentAccount.profile
            });

            if (profileStatus) {
                profileStatus.textContent = 'Profile settings saved successfully!';
                profileStatus.className = 'status success';
                setTimeout(() => {
                    profileStatus.className = 'status';
                }, 3000);
            }

        } catch (err) {
            console.error('Failed to save profile settings:', err);
            if (profileStatus) {
                profileStatus.textContent = 'Failed to save profile settings. Please try again.';
                profileStatus.className = 'status error';
            }
        }
    }

    // ===== SEARCH USERS (respects blocks) =====
    async function searchUsers() {
        const searchTerm = document.getElementById('user-search').value.trim().toLowerCase();
        const usersGrid = document.getElementById('users-grid');

        if (!usersGrid) return;

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
                <p>Looking for users matching "${escapeHtml(searchTerm)}"</p>
            </div>
        `;

        try {
            const [searchSnap, blocksSnap] = await Promise.all([
                get(userSearchRef),
                get(blocksRef)
            ]);
            cachedBlocksAll = blocksSnap.exists() ? (blocksSnap.val() || {}) : {};

            const results = [];
            cachedUserSearch = {};

            if (searchSnap.exists()) {
                searchSnap.forEach(childSnap => {
                    const uid = childSnap.key;
                    const userData = childSnap.val() || {};
                    if (!userData.username) return;

                    // Prevent showing yourself
                    if (currentUserUid && uid === currentUserUid) return;

                    // If this user has blocked me -> I must not find them
                    const theyBlockedMe = !!(currentUserUid && cachedBlocksAll?.[uid]?.[currentUserUid]);
                    if (theyBlockedMe) return;

                    // Username match
                    if (userData.username.toLowerCase().includes(searchTerm)) {
                        const enriched = { uid, ...userData };
                        results.push(enriched);
                        cachedUserSearch[uid] = enriched;
                    }
                });
            }

            if (results.length === 0) {
                usersGrid.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-user-times"></i>
                        <h3>No Users Found</h3>
                        <p>No users found matching "${escapeHtml(searchTerm)}"</p>
                    </div>
                `;
                return;
            }

            // Render using existing theme classes (.user-card)
            let html = '';
            results.forEach(u => {
                const pic = u.profile && u.profile.picture ? u.profile.picture : '';
                const joined = u.creationDate ? new Date(u.creationDate).toLocaleDateString() : 'Unknown';

                const iBlocked = !!(currentUserUid && cachedBlocksAll?.[currentUserUid]?.[u.uid]);
                const blockedBadge = iBlocked ? `<span class="profile-badge" style="margin-left:10px;"><i class="fas fa-ban"></i> Blocked</span>` : '';

                html += `
                    <div class="user-card">
                        <div class="user-card-header">
                            <div class="user-card-identity">
                                <div class="user-card-avatar">
                                    ${pic ? `<img src="${pic}" alt="${escapeHtml(u.username)}" onerror="this.style.display='none';">` : ''}
                                </div>
                                <div style="min-width:0;">
                                    <div class="user-card-name">${escapeHtml(u.username)} ${blockedBadge}</div>
                                    <div class="user-card-meta">Joined: ${escapeHtml(joined)}</div>
                                </div>
                            </div>
                            <div class="user-card-actions">
                                <button class="btn btn-secondary view-profile-btn" data-user-id="${u.uid}">
                                    <i class="fas fa-eye"></i>
                                </button>
                            </div>
                        </div>
                        <div class="user-card-body">
                            ${u.profile && u.profile.bio ? escapeHtml(u.profile.bio).slice(0, 140) : 'No bio set.'}
                        </div>
                    </div>
                `;
            });

            usersGrid.innerHTML = html;

            document.querySelectorAll('.view-profile-btn').forEach(btn => {
                btn.addEventListener('click', async function () {
                    const userId = this.getAttribute('data-user-id');
                    const userData = results.find(x => x.uid === userId);
                    if (userData) {
                        await openUserProfilePopup(userData);
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
        if (!statusMessage) return;
        statusMessage.textContent = message;
        statusMessage.className = `status ${type}`;
        setTimeout(() => {
            statusMessage.className = 'status';
        }, 5000);
    }

    function setStatus(el, message, type, clearAfterMs) {
        if (!el) return;
        el.textContent = message || '';
        el.className = `status ${type || ''}`.trim();
        if (clearAfterMs) {
            setTimeout(() => {
                el.className = 'status';
                el.textContent = '';
            }, clearAfterMs);
        }
    }

    function isCurrentUserModerator() {
        return !!(currentAccount && currentAccount.isModerator);
    }

    function showDashboard() {
        if (!currentAccount) {
            showLoginPage();
            return;
        }

        if (loginPage) loginPage.style.display = 'none';
        if (dashboardPage) dashboardPage.style.display = 'block';

        const ud = document.getElementById('username-display');
        if (ud) ud.textContent = `Welcome, ${currentAccount.username || 'User'}`;

        if (currentAccount.isModerator) {
            if (moderatorBadge) moderatorBadge.classList.remove('hidden');
            if (adminNav) adminNav.classList.remove('hidden');
        } else {
            if (moderatorBadge) moderatorBadge.classList.add('hidden');
            if (adminNav) adminNav.classList.add('hidden');
        }

        loadEvents();
        updateAdminInfo();
        updateAccountInfo();

        initializeUserSearch();

        // Start blocks listener for "my blocked" set (needed for chat+profile)
        startMyBlocksListener();

        // Start chat threads listener (for chat list)
        startThreadsListener();
    }

    function showLoginPage() {
        if (dashboardPage) dashboardPage.style.display = 'none';
        if (loginPage) loginPage.style.display = 'flex';

        const lu = document.getElementById('login-username');
        const lt = document.getElementById('login-token');
        if (lu) lu.value = '';
        if (lt) {
            lt.value = '';
            lt.type = 'password';
        }

        const tbtn = document.getElementById('toggle-token');
        if (tbtn && tbtn.querySelector('i')) tbtn.querySelector('i').className = 'fas fa-eye';

        if (loginStatus) {
            loginStatus.textContent = '';
            loginStatus.className = 'status';
        }

        if (accountCreationSection) accountCreationSection.classList.add('hidden');
        if (loginSection) loginSection.classList.remove('hidden');
    }

    // ===== UPDATE ACCOUNT INFO =====
    function updateAccountInfo() {
        if (!currentAccount) return;

        const au = document.getElementById('account-username');
        const cd = document.getElementById('account-creation-date');
        const tb = document.getElementById('total-bets');
        const wr = document.getElementById('winning-rate');
        const repEl = document.getElementById('account-reputation');

        if (au) au.textContent = currentAccount.username || '-';
        if (cd) cd.textContent = currentAccount.creationDate ? new Date(currentAccount.creationDate).toLocaleDateString() : '-';
        if (tb) tb.textContent = Array.isArray(currentAccount.bets) ? currentAccount.bets.length : 0;
        if (wr) wr.textContent = '0%';

        const reputation = typeof currentAccount.reputation === 'number' ? currentAccount.reputation : 0;
        if (repEl) repEl.textContent = reputation.toFixed(1);

        const profile = currentAccount.profile || {};
        const privacy = normalizePrivacy((profile && profile.privacy) || {});

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

        const bioInput = document.getElementById('user-bio');
        if (bioInput) bioInput.value = profile.bio || '';

        const reputationCheckbox = document.getElementById('privacy-reputation');
        const betsCheckbox = document.getElementById('privacy-bets');
        const predictionsCheckbox = document.getElementById('privacy-predictions');
        const chatsCheckbox = document.getElementById('privacy-chats');

        if (reputationCheckbox) reputationCheckbox.checked = privacy.showReputation;
        if (betsCheckbox) betsCheckbox.checked = privacy.showBets;
        if (predictionsCheckbox) predictionsCheckbox.checked = privacy.showPredictions;
        if (chatsCheckbox) chatsCheckbox.checked = privacy.showChats;

        renderPredictionsList(currentAccount);
    }
    // ===== UPDATED ADMIN INFO (account tables stay working) =====
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
                        const created = acc.creationDate ? new Date(acc.creationDate).toLocaleDateString() : '-';
                        const deletedAt = acc.deletedAt ? new Date(acc.deletedAt).toLocaleString() : '-';
                        const deletedBy = acc.deletedBy || 'Unknown';

                        deletedAccountsHTML += `
                            <tr>
                                <td>${escapeHtml(uname)}</td>
                                <td>${escapeHtml(created)}</td>
                                <td>${escapeHtml(deletedAt)}</td>
                                <td>${escapeHtml(deletedBy)}</td>
                                <td>
                                    <button class="btn-restore-account" data-uid="${uid}" data-username="${escapeHtml(uname)}">
                                        <i class="fas fa-undo"></i> Restore
                                    </button>
                                </td>
                            </tr>
                        `;
                    } else {
                        userCount++;
                        const uname = acc.username || '(unknown)';
                        const created = acc.creationDate ? new Date(acc.creationDate).toLocaleDateString() : '-';

                        activeAccountsHTML += `
                            <tr>
                                <td>${escapeHtml(uname)}</td>
                                <td>${escapeHtml(created)}</td>
                                <td>${acc.isModerator ? '<span class="moderator-badge">MODERATOR</span>' : 'User'}</td>
                                <td>
                                    <button class="btn-delete-account" data-uid="${uid}" data-username="${escapeHtml(uname)}">
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

        const tu = document.getElementById('total-users');
        const du = document.getElementById('deleted-users');
        if (tu) tu.textContent = userCount;
        if (du) du.textContent = deletedUserCount;

        try {
            const events = window.latestEvents || [];
            const te = document.getElementById('total-events');
            const ab = document.getElementById('active-bets');
            if (te) te.textContent = events.length;
            if (ab) ab.textContent = '0';
        } catch (error) {
            const te = document.getElementById('total-events');
            const ab = document.getElementById('active-bets');
            if (te) te.textContent = '0';
            if (ab) ab.textContent = '0';
        }

        const activeBody = document.getElementById('accounts-table-body');
        const deletedBody = document.getElementById('deleted-accounts-table-body');

        if (activeBody) {
            activeBody.innerHTML = activeAccountsHTML || `
                <tr>
                    <td colspan="4" style="text-align: center; color: var(--text-secondary);">No active accounts found</td>
                </tr>
            `;
        }

        if (deletedBody) {
            deletedBody.innerHTML = deletedAccountsHTML || `
                <tr>
                    <td colspan="5" style="text-align: center; color: var(--text-secondary);">No deleted accounts found</td>
                </tr>
            `;
        }

        document.querySelectorAll('.btn-delete-account').forEach(btn => {
            btn.addEventListener('click', function () {
                const uid = this.getAttribute('data-uid');
                const username = this.getAttribute('data-username');
                deleteAccount(uid, username);
            });
        });

        document.querySelectorAll('.btn-restore-account').forEach(btn => {
            btn.addEventListener('click', function () {
                const uid = this.getAttribute('data-uid');
                const username = this.getAttribute('data-username');
                restoreAccount(uid, username);
            });
        });

        if (window.renderEventLog) {
            window.renderEventLog();
        }
    }

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
            const updatesObj = {
                deleted: true,
                deletedAt: new Date().toISOString(),
                deletedBy: currentAccount.username || 'Unknown Moderator'
            };

            await update(ref(db, `accounts/${uid}`), updatesObj);

            await remove(ref(db, `userSearch/${uid}`));

            await showMessagePopup(
                'Account Deleted',
                `Account "${username}" has been successfully deleted. The user will be logged out if currently active.`
            );

            updateAdminInfo();

        } catch (err) {
            console.error('Failed to delete account:', err);
            await showMessagePopup('Error', 'Failed to delete account. Please try again.');
        }
    }

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
            const accountSnap = await get(ref(db, `accounts/${uid}`));
            if (!accountSnap.exists()) {
                throw new Error('Account not found');
            }

            const accountData = accountSnap.val();

            const updatesObj = {
                deleted: false,
                deletedAt: null,
                deletedBy: null
            };

            await update(ref(db, `accounts/${uid}`), updatesObj);

            await set(ref(db, `userSearch/${uid}`), {
                username: accountData.username,
                creationDate: accountData.creationDate,
                profile: accountData.profile || {}
            });

            await showMessagePopup(
                'Account Restored',
                `Account "${username}" has been successfully restored. The user can now log in again.`
            );

            updateAdminInfo();

        } catch (err) {
            console.error('Failed to restore account:', err);
            await showMessagePopup('Error', 'Failed to restore account. Please try again.');
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
            let status = 'pending';
            let statusLabel = 'Pending';

            if (pred.correct === true) {
                status = 'correct';
                statusLabel = 'Correct';
            } else if (pred.correct === false) {
                status = 'wrong';
                statusLabel = 'Wrong';
            } else {
                const events = window.latestEvents || [];
                const endedEvent = events.find(ev => ev.id === pred.eventId && ev.category === 'ended');
                if (endedEvent) {
                    status = 'pending';
                    statusLabel = 'Pending Resolution';
                } else {
                    status = 'pending';
                    statusLabel = 'Pending';
                }
            }

            const choice = pred.choice === 'A' ? (pred.teamA || 'Team A') : (pred.teamB || 'Team B');

            html += `
                <div class="prediction-item">
                    <div class="prediction-header">
                        <span class="prediction-event">${escapeHtml(pred.title || 'Event')}</span>
                        <span class="prediction-choice">You picked: ${escapeHtml(choice)}</span>
                    </div>
                    <div class="prediction-status ${status}">
                        Status: ${escapeHtml(statusLabel)}
                    </div>
                </div>
            `;
        });

        list.innerHTML = html;
    }

    // ===== DISPLAY EVENTS WITH PREDICTION STATUS =====
    window.displayFirebaseEvents = function (events) {
        const up = document.getElementById('upcoming-events');
        const ac = document.getElementById('active-events');
        const en = document.getElementById('ended-events');

        if (up) up.innerHTML = '';
        if (ac) ac.innerHTML = '';
        if (en) en.innerHTML = '';

        if (!events || events.length === 0) {
            const emptyHTML = `
                <div class="empty-state">
                    <i class="fas fa-calendar-times"></i>
                    <h3>No Events Available</h3>
                    <p>Check back later for OGW events.</p>
                </div>
            `;
            if (up) up.innerHTML = emptyHTML;
            if (ac) ac.innerHTML = emptyHTML;
            if (en) en.innerHTML = emptyHTML;
            return;
        }

        const upcoming = events.filter(event => event.category === 'upcoming');
        const active = events.filter(event => event.category === 'active');
        const ended = events.filter(event => event.category === 'ended');

        if (up) displayEvents(upcoming, up, 'upcoming');
        if (ac) displayEvents(active, ac, 'active');
        if (en) displayEvents(ended, en, 'ended');

        if (up && upcoming.length === 0) {
            up.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-calendar-times"></i>
                    <h3>No Upcoming Events</h3>
                    <p>Check back later for upcoming OGW events.</p>
                </div>
            `;
        }
        if (ac && active.length === 0) {
            ac.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-calendar-times"></i>
                    <h3>No Active Events</h3>
                    <p>There are currently no active OGW events.</p>
                </div>
            `;
        }
        if (en && ended.length === 0) {
            en.innerHTML = `
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

    function displayEvents(events, container, category) {
        if (!events || events.length === 0) return;
        const isMod = isCurrentUserModerator();
        let eventsHTML = '';

        events.forEach(event => {
            const menuHTML = isMod
                ? `<div class="event-menu" data-event-id="${event.id}"><i class="fas fa-ellipsis-v"></i></div>`
                : '';

            const userPrediction = currentAccount && Array.isArray(currentAccount.predictions)
                ? currentAccount.predictions.find(p => p.eventId === event.id)
                : null;

            const predictionStatusHTML = category === 'ended' && userPrediction
                ? `<div class="prediction-result ${userPrediction.correct ? 'correct' : 'wrong'}">
                      <strong>Your Prediction:</strong> ${escapeHtml(userPrediction.choice === 'A' ? event.teamA : event.teamB)}
                      <span style="margin-left: 8px;">
                          ${userPrediction.correct ? '✓ Correct' : '✗ Wrong'}
                      </span>
                   </div>`
                : '';

            const isPredictedA = userPrediction && userPrediction.choice === 'A';
            const isPredictedB = userPrediction && userPrediction.choice === 'B';

            const buttonStyleA = isPredictedA
                ? 'style="background-color: var(--success); color: white; border-color: var(--success);"'
                : 'style="background-color: rgba(255, 255, 255, 0.04); color: var(--text-secondary); border-color: rgba(255, 255, 255, 0.1);"';

            const buttonStyleB = isPredictedB
                ? 'style="background-color: var(--success); color: white; border-color: var(--success);"'
                : 'style="background-color: rgba(255, 255, 255, 0.04); color: var(--text-secondary); border-color: rgba(255, 255, 255, 0.1);"';

            eventsHTML += `
                <div class="event-card" data-event-id="${event.id}">
                    <div class="event-header">
                        <div>
                            <h3 class="event-title">${escapeHtml(event.title)}</h3>
                            <div class="event-date">Starts: ${escapeHtml(new Date(event.date).toLocaleString())}</div>
                        </div>
                        ${menuHTML}
                    </div>
                    <div class="event-body">
                        <div class="event-teams">
                            <div class="team">
                                <div class="team-logo">${escapeHtml(event.teamA.charAt(0))}</div>
                                <div>${escapeHtml(event.teamA)}</div>
                            </div>
                            <div class="vs">VS</div>
                            <div class="team">
                                <div class="team-logo">${escapeHtml(event.teamB.charAt(0))}</div>
                                <div>${escapeHtml(event.teamB)}</div>
                            </div>
                        </div>
                        <div class="event-odds">
                            <div class="odd">
                                <div>${escapeHtml(event.teamA)}</div>
                                <div class="odd-value">${escapeHtml(String(event.oddsA))}</div>
                            </div>
                            <div class="odd">
                                <div>Draw</div>
                                <div class="odd-value">${escapeHtml(String(event.oddsDraw))}</div>
                            </div>
                            <div class="odd">
                                <div>${escapeHtml(event.teamB)}</div>
                                <div class="odd-value">${escapeHtml(String(event.oddsB))}</div>
                            </div>
                        </div>
                        ${predictionStatusHTML}
                        ${category !== 'ended' ? `
                        <div class="prediction-actions">
                            <button class="predict-btn" data-event-id="${event.id}" data-choice="A" ${buttonStyleA}>
                                Predict ${escapeHtml(event.teamA)} win
                            </button>
                            <button class="predict-btn" data-event-id="${event.id}" data-choice="B" ${buttonStyleB}>
                                Predict ${escapeHtml(event.teamB)} win
                            </button>
                        </div>
                        ` : ''}
                    </div>
                </div>
            `;
        });

        container.innerHTML = eventsHTML;
    }

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
            const choice = predictBtn.getAttribute('data-choice');
            handlePrediction(eventId, choice);
        }
    });

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

    async function editEventFull(eventId) {
        const eventObj = findEventById(eventId);
        if (!eventObj) return;

        const formFields = [
            { name: 'title', label: 'Event Title', type: 'text', value: eventObj.title || '' },
            { name: 'teamA', label: 'Team A', type: 'text', value: eventObj.teamA || '' },
            { name: 'teamB', label: 'Team B', type: 'text', value: eventObj.teamB || '' },
            { name: 'date', label: 'Event Date & Time', type: 'datetime-local', value: eventObj.date || '' },
            {
                name: 'category', label: 'Category', type: 'select', value: eventObj.category || 'upcoming',
                options: [
                    { label: 'Upcoming', value: 'upcoming' },
                    { label: 'Active', value: 'active' },
                    { label: 'Ended', value: 'ended' }
                ]
            },
            { name: 'oddsA', label: 'Odds Team A', type: 'number', value: eventObj.oddsA || 2.10, placeholder: '2.10' },
            { name: 'oddsDraw', label: 'Odds Draw', type: 'number', value: eventObj.oddsDraw || 3.25, placeholder: '3.25' },
            { name: 'oddsB', label: 'Odds Team B', type: 'number', value: eventObj.oddsB || 2.80, placeholder: '2.80' }
        ];

        const result = await showFormPopup('Edit Event', formFields, 'Save Changes', 'Cancel');
        if (!result) return;

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

            await resolveEventPredictions(eventObj, winnerChoice);

            await showMessagePopup('Predictions Resolved', `Event ended! Reputation has been awarded to users with correct predictions.`);

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

        eventObj.category = newCategory;
        const key = window.eventKeyMap[eventId];
        if (!key) return;

        try {
            await set(ref(db, `events/${key}`), eventObj);
            await showMessagePopup('Success', `Event moved to ${newCategory} successfully!`);

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

    async function resolveEventPredictions(eventObj, winnerChoice) {
        try {
            const snap = await get(accountsRef);
            if (!snap.exists()) return;

            const updatesObj = {};

            snap.forEach(childSnap => {
                const uid = childSnap.key;
                const acc = childSnap.val() || {};
                if (!Array.isArray(acc.predictions)) return;

                let changed = false;
                acc.predictions.forEach(pred => {
                    if (pred.eventId === eventObj.id && (pred.correct === null || typeof pred.correct === 'undefined')) {
                        const userChoice = String(pred.choice).toUpperCase();
                        const actualWinner = String(winnerChoice).toUpperCase();
                        const correct = userChoice === actualWinner;

                        pred.correct = correct;
                        if (typeof acc.reputation !== 'number') {
                            acc.reputation = 0;
                        }
                        acc.reputation += correct ? 1 : -0.5;
                        changed = true;
                    }
                });

                if (changed) {
                    updatesObj[`accounts/${uid}`] = acc;
                }
            });

            if (Object.keys(updatesObj).length > 0) {
                await update(ref(db), updatesObj);
            }
        } catch (err) {
            console.error('Failed to resolve predictions:', err);
        }
    }

    async function handlePrediction(eventId, choice) {
        if (!currentAccount || !currentUserUid) {
            await showMessagePopup('Login Required', 'You must be logged in to make predictions.');
            return;
        }

        const eventObj = findEventById(eventId);
        if (!eventObj) {
            await showMessagePopup('Error', 'Event not found.');
            return;
        }

        if (eventObj.category === 'ended') {
            await showMessagePopup('Event Ended', 'This event has already ended. You cannot make new predictions.');
            return;
        }

        if (!Array.isArray(currentAccount.predictions)) {
            currentAccount.predictions = [];
        }

        let existing = currentAccount.predictions.find(p => p.eventId === eventId);

        if (existing) {
            if (existing.choice === choice) {
                return;
            }

            const confirmSwitch = await showConfirmPopup(
                'Switch Prediction',
                `You already predicted ${existing.choice === 'A' ? eventObj.teamA : eventObj.teamB}. Do you want to switch to ${choice === 'A' ? eventObj.teamA : eventObj.teamB}?`,
                'Switch',
                'Keep Current'
            );

            if (!confirmSwitch) return;

            existing.choice = choice;
            existing.correct = null;
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
            await showMessagePopup('Error', 'Failed to save prediction.');
            return;
        }

        updatePredictionButtons(eventId, choice);
        updateAccountInfo();
    }

    function updatePredictionButtons(eventId, selectedChoice) {
        const predictBtns = document.querySelectorAll(`.predict-btn[data-event-id="${eventId}"]`);

        predictBtns.forEach(btn => {
            const c = btn.getAttribute('data-choice');
            if (c === selectedChoice) {
                btn.style.backgroundColor = 'var(--success)';
                btn.style.color = 'white';
                btn.style.borderColor = 'var(--success)';
            } else {
                btn.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                btn.style.color = 'var(--text-secondary)';
                btn.style.borderColor = 'rgba(255, 255, 255, 0.1)';
            }
        });
    }

    async function refreshAccountData() {
        if (!currentUserUid) return;

        try {
            const snap = await get(ref(db, `accounts/${currentUserUid}`));
            if (snap.exists()) {
                currentAccount = snap.val() || {};
                updateAccountInfo();
                loadEvents();

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
                    <td>${escapeHtml(entry.title || 'Event')}</td>
                    <td>${escapeHtml(entry.winner || '-')}</td>
                    <td>${escapeHtml(entry.endedBy || 'Unknown')}</td>
                    <td>${escapeHtml(endedAt)}</td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    };

    // ===== MIGRATION HELPER (includes showChats) =====
    window.migrateExistingUsersToSearch = async function () {
        const user = auth.currentUser;

        if (!user) {
            console.log('Please log in as a moderator first');
            return;
        }

        try {
            const accountsSnap = await get(accountsRef);
            let migrated = 0;

            if (accountsSnap.exists()) {
                const promises = [];

                accountsSnap.forEach(childSnap => {
                    const uid = childSnap.key;
                    const account = childSnap.val() || {};

                    if (!account.deleted) {
                        const profile = account.profile || {};
                        const privacy = normalizePrivacy((profile && profile.privacy) || {});
                        const searchData = {
                            username: account.username,
                            creationDate: account.creationDate,
                            profile: {
                                picture: profile.picture || "",
                                bio: profile.bio || "",
                                privacy: {
                                    showReputation: privacy.showReputation,
                                    showBets: privacy.showBets,
                                    showPredictions: privacy.showPredictions,
                                    showChats: privacy.showChats
                                }
                            }
                        };

                        promises.push(set(ref(db, `userSearch/${uid}`), searchData));
                        migrated++;
                    }
                });

                await Promise.all(promises);
                console.log(`Successfully migrated ${migrated} users to search index`);
                await showMessagePopup('Migration Complete', `Successfully migrated ${migrated} users to search index.`);
            }
        } catch (err) {
            console.error('Migration failed:', err);
            await showMessagePopup('Migration Failed', 'Failed to migrate users. Check console for details.');
        }
    };

    // =========================
    // CHAT + BLOCKING SYSTEM
    // =========================

    function openChatOverlay() {
        if (!chatOverlay) return;
        chatOverlay.classList.remove('hidden');
        // No "active" class required here because css uses .hidden only for chat overlay
        // But keep consistent
        setStatus(chatStatusEl, '', '', 0);

        // Auto-select announcements by default
        selectAnnouncementsChat();
    }

    function closeChatOverlay() {
        if (!chatOverlay) return;
        chatOverlay.classList.add('hidden');
        // Keep selection but stop messages listener to save bandwidth
        stopMessagesListener();
        currentChat = null;
        updateChatHeader(null);
        renderChatEmptyState();
    }

    function renderChatEmptyState() {
        if (!chatMessagesEl) return;
        if (chatEmptyStateEl) chatEmptyStateEl.classList.remove('hidden');
        chatMessagesEl.innerHTML = chatEmptyStateEl ? chatEmptyStateEl.outerHTML : '';
    }

    function updateChatHeader(chat) {
        if (!chatSelectedTitleEl || !chatSelectedSubtitleEl) return;

        if (!chat) {
            chatSelectedTitleEl.textContent = 'Select a chat';
            chatSelectedSubtitleEl.textContent = '';
            if (viewChatProfileBtn) viewChatProfileBtn.classList.add('hidden');
            if (blockChatUserBtn) blockChatUserBtn.classList.add('hidden');
            setComposeEnabled(false);
            return;
        }

        if (chat.type === 'announcements') {
            chatSelectedTitleEl.textContent = 'Announcements';
            chatSelectedSubtitleEl.textContent = 'Read-only for members';
            if (viewChatProfileBtn) viewChatProfileBtn.classList.add('hidden');
            if (blockChatUserBtn) blockChatUserBtn.classList.add('hidden');

            if (isCurrentUserModerator()) {
                setComposeEnabled(true);
                if (chatMessageInputEl) chatMessageInputEl.placeholder = 'Post an announcement...';
            } else {
                setComposeEnabled(false);
                if (chatMessageInputEl) chatMessageInputEl.placeholder = 'Announcements are read-only';
            }
            return;
        }

        if (chat.type === 'dm') {
            chatSelectedTitleEl.textContent = chat.otherUsername || 'Chat';
            chatSelectedSubtitleEl.textContent = '';
            if (viewChatProfileBtn) viewChatProfileBtn.classList.remove('hidden');
            if (blockChatUserBtn) blockChatUserBtn.classList.remove('hidden');

            // Block restriction: if I blocked them -> cannot chat
            const iBlocked = myBlockedSet.has(chat.otherUid);
            if (iBlocked) {
                setComposeEnabled(false);
                if (chatMessageInputEl) chatMessageInputEl.placeholder = 'You blocked this user';
                if (chatSelectedSubtitleEl) chatSelectedSubtitleEl.textContent = 'You blocked this user';
                if (blockChatUserBtn) blockChatUserBtn.innerHTML = `<i class="fas fa-unlock"></i> Unblock`;
            } else {
                setComposeEnabled(true);
                if (chatMessageInputEl) chatMessageInputEl.placeholder = 'Type a message...';
                if (blockChatUserBtn) blockChatUserBtn.innerHTML = `<i class="fas fa-ban"></i> Block`;
            }
        }
    }

    function setComposeEnabled(enabled) {
        const compose = document.querySelector('.chat-compose');
        if (!compose || !chatMessageInputEl || !sendChatMessageBtn) return;

        if (enabled) {
            compose.classList.remove('disabled');
            chatMessageInputEl.disabled = false;
            sendChatMessageBtn.disabled = false;
        } else {
            compose.classList.add('disabled');
            chatMessageInputEl.disabled = true;
            sendChatMessageBtn.disabled = true;
        }
    }

    function makeDmThreadId(uid1, uid2) {
        const a = String(uid1 || '');
        const b = String(uid2 || '');
        return [a, b].sort().join('_');
    }

    async function getUserSearchByUid(uid) {
        if (!uid) return null;
        if (cachedUserSearch && cachedUserSearch[uid]) return cachedUserSearch[uid];

        try {
            const snap = await get(ref(db, `userSearch/${uid}`));
            if (!snap.exists()) return null;
            const val = snap.val() || {};
            const obj = { uid, ...val };
            cachedUserSearch[uid] = obj;
            return obj;
        } catch (e) {
            return null;
        }
    }

    async function startOrOpenDm(otherUid, otherUserDataMaybe) {
        if (!currentUserUid || !currentAccount) {
            await showMessagePopup('Login Required', 'You must be logged in to chat.');
            return;
        }
        if (!otherUid) return;

        // If other blocked me -> shouldn't happen due to search filtering, but enforce
        const theyBlockedMe = (await get(ref(db, `blocks/${otherUid}/${currentUserUid}`))).exists();
        if (theyBlockedMe) {
            await showMessagePopup('Cannot Chat', 'You cannot chat with this user.');
            return;
        }

        // If I blocked them -> chat disabled
        const iBlocked = myBlockedSet.has(otherUid);
        if (iBlocked) {
            await showMessagePopup('Blocked', 'You blocked this user. Unblock them to start chatting.');
            return;
        }

        // Respect privacy: allow chat requests
        const otherData = otherUserDataMaybe || await getUserSearchByUid(otherUid);
        if (!otherData) {
            await showMessagePopup('Not Found', 'User could not be loaded.');
            return;
        }

        const privacy = normalizePrivacy((otherData.profile && otherData.profile.privacy) || {});
        if (!privacy.showChats) {
            await showMessagePopup('Chat Disabled', 'This user disabled chat requests.');
            return;
        }

        const threadId = makeDmThreadId(currentUserUid, otherUid);

        // Ensure thread meta exists
        try {
            const metaSnap = await get(ref(db, `chats/dm/${threadId}/meta`));
            if (!metaSnap.exists()) {
                await set(ref(db, `chats/dm/${threadId}/meta`), {
                    a: [currentUserUid, otherUid].sort()[0],
                    b: [currentUserUid, otherUid].sort()[1],
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    lastText: ''
                });
            }

            // Ensure both userThreads entries exist
            const meEntry = {
                otherUid: otherUid,
                otherUsername: otherData.username || 'User',
                updatedAt: Date.now(),
                lastText: ''
            };
            const themEntry = {
                otherUid: currentUserUid,
                otherUsername: currentAccount.username || 'User',
                updatedAt: Date.now(),
                lastText: ''
            };

            await update(ref(db, `chats/userThreads/${currentUserUid}/${threadId}`), meEntry);
            await update(ref(db, `chats/userThreads/${otherUid}/${threadId}`), themEntry);

        } catch (err) {
            console.error('Failed to initialize DM:', err);
            await showMessagePopup('Error', 'Failed to open chat.');
            return;
        }

        openChatOverlay();
        await selectDmChat(threadId, otherUid);
    }

    async function selectAnnouncementsChat() {
        if (!currentUserUid) return;
        currentChat = { type: 'announcements' };
        updateChatHeader(currentChat);

        // Highlight in list
        highlightChatListItem('announcements');

        // Messages listener
        stopMessagesListener();
        liveMessagesUnsub = onValue(ref(db, 'chats/announcements/messages'), (snap) => {
            const messages = [];
            if (snap.exists()) {
                snap.forEach(child => {
                    const msg = child.val() || {};
                    messages.push({ _key: child.key, ...msg });
                });
            }
            messages.sort((a, b) => (a.ts || 0) - (b.ts || 0));
            renderAnnouncementsMessages(messages);
        });
    }

    async function selectDmChat(threadId, otherUid) {
        const otherData = await getUserSearchByUid(otherUid);
        const otherUsername = otherData?.username || 'User';

        currentChat = {
            type: 'dm',
            threadId,
            otherUid,
            otherUsername,
            otherProfile: otherData?.profile || {}
        };

        updateChatHeader(currentChat);

        // Highlight in list
        highlightChatListItem(threadId);

        // Messages listener
        stopMessagesListener();
        liveMessagesUnsub = onValue(ref(db, `chats/dm/${threadId}/messages`), async (snap) => {
            // If chat was deleted (block), snap may not exist anymore
            const messages = [];
            if (snap.exists()) {
                snap.forEach(child => {
                    const msg = child.val() || {};
                    messages.push({ _key: child.key, ...msg });
                });
            }

            messages.sort((a, b) => (a.ts || 0) - (b.ts || 0));

            // If they blocked me now, delete DM UI (they shouldn't see me; but if happens mid-session)
            const theyBlockedMe = (await get(ref(db, `blocks/${otherUid}/${currentUserUid}`))).exists();
            if (theyBlockedMe) {
                // Close chat and refresh list
                await showMessagePopup('Chat Closed', 'This chat is no longer available.');
                currentChat = null;
                updateChatHeader(null);
                renderChatEmptyState();
                return;
            }

            renderDmMessages(messages, otherData);
        });
    }

    function stopMessagesListener() {
        if (typeof liveMessagesUnsub === 'function') {
            try { liveMessagesUnsub(); } catch (e) {}
        }
        liveMessagesUnsub = null;
    }

    function stopThreadsListener() {
        if (typeof liveThreadsUnsub === 'function') {
            try { liveThreadsUnsub(); } catch (e) {}
        }
        liveThreadsUnsub = null;
    }

    function startThreadsListener() {
        stopThreadsListener();
        if (!currentUserUid) return;

        liveThreadsUnsub = onValue(ref(db, `chats/userThreads/${currentUserUid}`), (snap) => {
            const threads = [];
            if (snap.exists()) {
                snap.forEach(child => {
                    const threadId = child.key;
                    const data = child.val() || {};
                    threads.push({ threadId, ...data });
                });
            }
            // Store to global cache for rendering
            window._chatThreadsCache = threads;
            renderChatListFromCache();
        });
    }

    function startMyBlocksListener() {
        // Load blocks/<me> into myBlockedSet
        if (!currentUserUid) return;
        onValue(ref(db, `blocks/${currentUserUid}`), (snap) => {
            const s = new Set();
            if (snap.exists()) {
                snap.forEach(child => {
                    if (child.key) s.add(child.key);
                });
            }
            myBlockedSet = s;

            // Update header state if in DM
            if (currentChat && currentChat.type === 'dm') {
                updateChatHeader(currentChat);
            }

            // Refresh search results UI indicators if user is in community tab (optional)
        });
    }

    function renderChatListFromCache() {
        if (!chatListEl) return;
        const q = (chatSearchEl ? chatSearchEl.value : '').trim().toLowerCase();
        const threads = Array.isArray(window._chatThreadsCache) ? window._chatThreadsCache : [];

        // Always pinned announcements first
        let html = `
            <div class="chat-item pinned" data-chat-id="announcements">
                <div class="chat-item-avatar"><i class="fas fa-shield-alt"></i></div>
                <div class="chat-item-body">
                    <div class="chat-item-title">Announcements</div>
                    <div class="chat-item-preview">Important updates</div>
                </div>
                <div class="chat-item-meta"></div>
            </div>
        `;

        // Sort threads by updatedAt desc
        threads.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

        threads.forEach(t => {
            const title = t.otherUsername || 'Chat';
            const preview = t.lastText ? String(t.lastText) : '';
            const updatedAt = t.updatedAt ? new Date(t.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

            if (q && !title.toLowerCase().includes(q) && !preview.toLowerCase().includes(q)) return;

            const disabled = myBlockedSet.has(t.otherUid);

            html += `
                <div class="chat-item ${disabled ? 'chat-item-disabled' : ''}" data-chat-id="${t.threadId}" data-other-uid="${t.otherUid}">
                    <div class="chat-item-avatar">
                        ${'' /* avatar resolved in messages; keep list simple */ }
                        <i class="fas fa-user"></i>
                    </div>
                    <div class="chat-item-body">
                        <div class="chat-item-title">${escapeHtml(title)}</div>
                        <div class="chat-item-preview">${escapeHtml(preview)}</div>
                    </div>
                    <div class="chat-item-meta">${escapeHtml(updatedAt)}</div>
                </div>
            `;
        });

        chatListEl.innerHTML = html;

        // Bind click handlers
        chatListEl.querySelectorAll('.chat-item').forEach(item => {
            item.addEventListener('click', async () => {
                const id = item.getAttribute('data-chat-id');
                if (!id) return;

                if (id === 'announcements') {
                    await selectAnnouncementsChat();
                    return;
                }

                const otherUid = item.getAttribute('data-other-uid');
                if (!otherUid) return;

                // If blocked: allow opening profile but not chat. Requirement: A can see B but cannot open chat.
                if (myBlockedSet.has(otherUid)) {
                    const userData = await getUserSearchByUid(otherUid);
                    if (userData) {
                        await openUserProfilePopup(userData);
                    } else {
                        await showMessagePopup('Blocked', 'You blocked this user. Unblock them to chat.');
                    }
                    return;
                }

                await selectDmChat(id, otherUid);
            });
        });

        // Re-highlight current selection
        if (currentChat) {
            highlightChatListItem(currentChat.type === 'announcements' ? 'announcements' : currentChat.threadId);
        }
    }

    function highlightChatListItem(chatId) {
        if (!chatListEl) return;
        chatListEl.querySelectorAll('.chat-item').forEach(el => el.classList.remove('active'));
        const target = chatListEl.querySelector(`.chat-item[data-chat-id="${chatId}"]`);
        if (target) target.classList.add('active');
    }

    function renderAnnouncementsMessages(messages) {
        if (!chatMessagesEl) return;

        if (messages.length === 0) {
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
        messages.forEach(m => {
            const time = m.ts ? new Date(m.ts).toLocaleString() : '';
            const postedBy = m.postedBy ? ` • posted by ${m.postedBy}` : '';

            html += `
                <div class="chat-message-row theirs">
                    <div class="chat-message-avatar">
                        <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--accent);">
                            <i class="fas fa-shield-alt"></i>
                        </div>
                    </div>
                    <div class="chat-message-bubble">
                        <div class="chat-message-header">
                            <div class="chat-message-name">Announcements${escapeHtml(postedBy)}</div>
                            <div class="chat-message-time">${escapeHtml(time)}</div>
                        </div>
                        <div class="chat-message-text">${escapeHtml(m.text || '')}</div>
                    </div>
                </div>
            `;
        });

        chatMessagesEl.innerHTML = html;
        scrollChatToBottom();
    }

    function renderDmMessages(messages, otherData) {
        if (!chatMessagesEl) return;

        if (!messages || messages.length === 0) {
            chatMessagesEl.innerHTML = `
                <div class="chat-empty-state">
                    <i class="fas fa-comments"></i>
                    <h3>No messages yet</h3>
                    <p>Say hello!</p>
                </div>
            `;
            scrollChatToBottom();
            return;
        }

        const otherPic = otherData?.profile?.picture || '';
        const otherName = otherData?.username || currentChat?.otherUsername || 'User';

        let html = '';
        messages.forEach(m => {
            const isMine = (m.fromUid && currentUserUid && m.fromUid === currentUserUid);

            if (isMine) {
                html += `
                    <div class="chat-message-row mine">
                        <div class="chat-message-bubble">
                            <div class="chat-message-text">${escapeHtml(m.text || '')}</div>
                        </div>
                    </div>
                `;
            } else {
                const time = m.ts ? new Date(m.ts).toLocaleString() : '';
                html += `
                    <div class="chat-message-row theirs">
                        <div class="chat-message-avatar">
                            ${otherPic ? `<img src="${otherPic}" alt="${escapeHtml(otherName)}" onerror="this.style.display='none';">` : `
                                <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.75);">
                                    <i class="fas fa-user"></i>
                                </div>
                            `}
                        </div>
                        <div class="chat-message-bubble">
                            <div class="chat-message-header">
                                <div class="chat-message-name">${escapeHtml(otherName)}</div>
                                <div class="chat-message-time">${escapeHtml(time)}</div>
                            </div>
                            <div class="chat-message-text">${escapeHtml(m.text || '')}</div>
                        </div>
                    </div>
                `;
            }
        });

        chatMessagesEl.innerHTML = html;
        scrollChatToBottom();
    }

    function scrollChatToBottom() {
        if (!chatMessagesEl) return;
        // Slight delay for layout
        setTimeout(() => {
            chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
        }, 10);
    }

    async function sendCurrentChatMessage() {
        if (!currentUserUid || !currentAccount) return;
        if (!currentChat) return;

        const text = (chatMessageInputEl ? chatMessageInputEl.value : '').trim();
        if (!text) return;

        // Announcements: mods only
        if (currentChat.type === 'announcements') {
            if (!isCurrentUserModerator()) return;

            try {
                const msg = {
                    text,
                    ts: Date.now(),
                    postedByUid: currentUserUid,
                    postedBy: currentAccount.username || 'Moderator'
                };
                await push(ref(db, 'chats/announcements/messages'), msg);
                if (chatMessageInputEl) chatMessageInputEl.value = '';
            } catch (err) {
                console.error('Send announcement via chat failed:', err);
                setStatus(chatStatusEl, 'Failed to send.', 'error', 2500);
            }
            return;
        }

        // DMs: blocked restriction
        if (currentChat.type === 'dm') {
            const otherUid = currentChat.otherUid;
            if (!otherUid) return;

            // If I blocked them
            if (myBlockedSet.has(otherUid)) {
                setStatus(chatStatusEl, 'You blocked this user.', 'error', 2500);
                return;
            }

            // If they blocked me (shouldn't happen, but enforce)
            const theyBlockedMe = (await get(ref(db, `blocks/${otherUid}/${currentUserUid}`))).exists();
            if (theyBlockedMe) {
                setStatus(chatStatusEl, 'Chat is not available.', 'error', 2500);
                return;
            }

            try {
                const msg = {
                    fromUid: currentUserUid,
                    text,
                    ts: Date.now()
                };

                const threadId = currentChat.threadId;
                await push(ref(db, `chats/dm/${threadId}/messages`), msg);

                // Update meta + indexes
                const now = Date.now();
                const lastText = text.slice(0, 120);

                await update(ref(db, `chats/dm/${threadId}/meta`), {
                    updatedAt: now,
                    lastText: lastText
                });

                await update(ref(db, `chats/userThreads/${currentUserUid}/${threadId}`), {
                    updatedAt: now,
                    lastText: lastText
                });

                await update(ref(db, `chats/userThreads/${otherUid}/${threadId}`), {
                    updatedAt: now,
                    lastText: lastText
                });

                if (chatMessageInputEl) chatMessageInputEl.value = '';
            } catch (err) {
                console.error('Send DM failed:', err);
                setStatus(chatStatusEl, 'Failed to send.', 'error', 2500);
            }
        }
    }

    async function blockUser(targetUid, targetUsername) {
        if (!currentUserUid || !targetUid) return;

        const ok = await showConfirmPopup(
            'Block User',
            `Block "${targetUsername}"? They will not be able to find your profile, and your chat will be deleted.`,
            'Block',
            'Cancel'
        );
        if (!ok) return;

        try {
            await set(ref(db, `blocks/${currentUserUid}/${targetUid}`), {
                ts: Date.now()
            });

            // Delete DM thread and indexes (applies until unblock)
            const threadId = makeDmThreadId(currentUserUid, targetUid);
            await remove(ref(db, `chats/dm/${threadId}`));
            await remove(ref(db, `chats/userThreads/${currentUserUid}/${threadId}`));
            await remove(ref(db, `chats/userThreads/${targetUid}/${threadId}`));

            // Update local set quickly
            myBlockedSet.add(targetUid);

            // If currently viewing this DM, close it
            if (currentChat && currentChat.type === 'dm' && currentChat.otherUid === targetUid) {
                currentChat = null;
                updateChatHeader(null);
                renderChatEmptyState();
                stopMessagesListener();
            }

            setStatus(chatStatusEl, `Blocked ${targetUsername}.`, 'success', 2500);
            renderChatListFromCache();
        } catch (err) {
            console.error('Failed to block user:', err);
            await showMessagePopup('Error', 'Failed to block user.');
        }
    }

    async function unblockUser(targetUid, targetUsername) {
        if (!currentUserUid || !targetUid) return;

        const ok = await showConfirmPopup(
            'Unblock User',
            `Unblock "${targetUsername}"?`,
            'Unblock',
            'Cancel'
        );
        if (!ok) return;

        try {
            await remove(ref(db, `blocks/${currentUserUid}/${targetUid}`));
            myBlockedSet.delete(targetUid);

            // If in dm, re-enable compose
            if (currentChat && currentChat.type === 'dm' && currentChat.otherUid === targetUid) {
                updateChatHeader(currentChat);
            }

            setStatus(chatStatusEl, `Unblocked ${targetUsername}.`, 'success', 2500);
            renderChatListFromCache();
        } catch (err) {
            console.error('Failed to unblock user:', err);
            await showMessagePopup('Error', 'Failed to unblock user.');
        }
    }

    // =========================
    // End file
    // =========================
});
