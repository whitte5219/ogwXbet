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
    update,
    onChildAdded,
    onChildRemoved,
    query,
    orderByChild,
    equalTo
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

// Database references
const eventsRef = ref(db, "events");
const eventLogRef = ref(db, "eventLog");
const accountsRef = ref(db, "accounts");
const userSearchRef = ref(db, "userSearch");
const chatsRef = ref(db, "chats");
const blocksRef = ref(db, "blocks");

// Global state
window.eventKeyMap = {};
let currentUserUid = null;
let currentAccount = null;
let currentChatId = null;
let currentChatOtherUser = null;
let chatListeners = {};
let chatListListener = null;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function () {
    // ===== DOM ELEMENTS =====
    const loginPage = document.getElementById('login-page');
    const dashboardPage = document.getElementById('dashboard-page');
    const accountCreationSection = document.getElementById('account-creation');
    const loginSection = document.getElementById('login-section');
    const adminNav = document.getElementById('admin-nav');
    const moderatorBadge = document.getElementById('moderator-badge');
    
    // Login elements
    const createAccountBtn = document.getElementById('create-account-btn');
    const loginBtn = document.getElementById('login-btn');
    const showRegisterBtn = document.getElementById('show-register-btn');
    const showLoginBtn = document.getElementById('show-login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const toggleTokenBtn = document.getElementById('toggle-token');
    
    // Profile elements
    const updatePictureBtn = document.getElementById('update-picture-btn');
    const saveProfileBtn = document.getElementById('save-profile-btn');
    const searchUserBtn = document.getElementById('search-user-btn');
    const refreshPredictionsBtn = document.getElementById('refresh-predictions-btn');
    
    // Chat elements
    const openChatBtn = document.getElementById('open-chat-btn');
    const chatPopup = document.getElementById('chat-popup');
    const closeChatBtn = document.getElementById('close-chat-btn');
    const chatListContainer = document.getElementById('chat-list');
    const chatMessagesContainer = document.getElementById('chat-messages');
    const chatMessageInput = document.getElementById('chat-message-input');
    const sendChatMessageBtn = document.getElementById('send-chat-message');
    const chatHeaderUsername = document.getElementById('chat-header-username');
    const chatHeaderStatus = document.getElementById('chat-header-status');
    const viewProfileInChatBtn = document.getElementById('view-profile-in-chat');
    const blockUserInChatBtn = document.getElementById('block-user-in-chat');
    const chatSearchInput = document.getElementById('chat-search-input');
    const newChatBtn = document.getElementById('new-chat-btn');
    
    // Admin elements
    const changeTokenBtn = document.getElementById('change-token-btn');
    const addEventBtn = document.getElementById('add-event-btn');
    const clearEventLogBtn = document.getElementById('clear-event-log-btn');
    const adminBroadcastBtn = document.getElementById('admin-broadcast-btn');
    const sendBroadcastBtn = document.getElementById('send-broadcast-btn');
    const broadcastMessageInput = document.getElementById('broadcast-message-input');
    
    // Popup elements
    const popupOverlay = document.getElementById('popup-overlay');
    const popupTitle = document.getElementById('popup-title');
    const popupMessage = document.getElementById('popup-message');
    const popupInput = document.getElementById('popup-input');
    const popupButtons = document.getElementById('popup-buttons');
    const userProfilePopup = document.getElementById('user-profile-popup');
    const closeProfilePopup = document.getElementById('close-profile-popup');
    
    // Status elements
    const statusMessage = document.getElementById('status-message');
    const loginStatus = document.getElementById('login-status');
    const tokenStatus = document.getElementById('token-status');
    const eventLogStatus = document.getElementById('event-log-status');
    const profileStatus = document.getElementById('profile-status');

    // ===== POPUP SYSTEM =====
    function closePopup() {
        if (!popupOverlay) return;
        popupOverlay.classList.remove('active');
        setTimeout(() => {
            popupOverlay.classList.add('hidden');
        }, 200);
    }

    function showPopup(options) {
        return new Promise(resolve => {
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
            buttons: [{ text: buttonText, value: true, type: 'confirm' }]
        });
    }

    async function showConfirmPopup(title, message, confirmText = 'Confirm', cancelText = 'Cancel') {
        const result = await showPopup({
            title,
            message,
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
        const buttons = choices.map(ch => ({
            text: ch.label,
            value: ch.value,
            type: 'confirm'
        }));
        buttons.push({ text: cancelText, value: null, type: 'cancel' });

        const result = await showPopup({ title, message, buttons });
        if (!result) return null;
        return result.button;
    }

    async function showFormPopup(title, fields, confirmText = 'Save', cancelText = 'Cancel') {
        return new Promise(resolve => {
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

    // ===== USER PROFILE POPUP =====
    function closeUserProfilePopup() {
        userProfilePopup.classList.remove('active');
        setTimeout(() => {
            userProfilePopup.classList.add('hidden');
        }, 200);
    }

    function openUserProfilePopup(userData) {
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
                         onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
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

            <div class="profile-popup-actions" style="margin-top: 20px; display: flex; gap: 10px;">
                ${userData.uid && userData.uid !== currentUserUid ? `
                    <button class="btn" id="profile-chat-btn" data-user-id="${userData.uid}" data-username="${userData.username}">
                        <i class="fas fa-comment-alt"></i> Start Chat
                    </button>
                    <button class="btn btn-secondary" id="profile-block-btn" data-user-id="${userData.uid}" data-username="${userData.username}">
                        <i class="fas fa-ban"></i> Block User
                    </button>
                ` : ''}
            </div>
        `;

        setTimeout(() => {
            const chatBtn = document.getElementById('profile-chat-btn');
            const blockBtn = document.getElementById('profile-block-btn');
            
            if (chatBtn) {
                chatBtn.addEventListener('click', function() {
                    const userId = this.getAttribute('data-user-id');
                    const username = this.getAttribute('data-username');
                    closeUserProfilePopup();
                    startOrOpenChat(userId, username);
                });
            }
            
            if (blockBtn) {
                blockBtn.addEventListener('click', async function() {
                    const userId = this.getAttribute('data-user-id');
                    const username = this.getAttribute('data-username');
                    // Close profile popup first to fix layering
                    closeUserProfilePopup();
                    // Small delay to ensure popup is closed
                    await new Promise(resolve => setTimeout(resolve, 50));
                    await blockUser(userId, username);
                });
            }
        }, 100);

        userProfilePopup.classList.remove('hidden');
        requestAnimationFrame(() => {
            userProfilePopup.classList.add('active');
        });
    }

    // ===== CHAT SYSTEM =====
    function openChatPopup() {
        chatPopup.classList.remove('hidden');
        requestAnimationFrame(() => {
            chatPopup.classList.add('active');
            loadChatList();
        });
    }

    function closeChatPopup() {
        chatPopup.classList.remove('active');
        setTimeout(() => {
            chatPopup.classList.add('hidden');
            currentChatId = null;
            currentChatOtherUser = null;
            chatMessagesContainer.innerHTML = '';
            chatHeaderUsername.textContent = 'Select a conversation';
            chatHeaderStatus.textContent = 'Click on a conversation to start chatting';
            chatMessageInput.value = '';
            chatMessageInput.disabled = true;
            sendChatMessageBtn.disabled = true;
            viewProfileInChatBtn.style.display = 'none';
            blockUserInChatBtn.style.display = 'none';
            
            Object.values(chatListeners).forEach(unsubscribe => {
                if (unsubscribe) unsubscribe();
            });
            chatListeners = {};
            
            if (chatListListener) {
                chatListListener();
                chatListListener = null;
            }
        }, 200);
    }

    function generateChatId(userId1, userId2) {
        const sortedIds = [userId1, userId2].sort();
        return `chat_${sortedIds[0]}_${sortedIds[1]}`;
    }

    async function startOrOpenChat(otherUserId, otherUsername) {
        if (!currentUserUid || !otherUserId || otherUserId === currentUserUid) return;
        
        const isBlocked = await checkIfBlocked(otherUserId);
        if (isBlocked) {
            await showMessagePopup('Cannot Start Chat', 'You have blocked this user. Unblock them first to start a chat.');
            return;
        }
        
        const amIBlocked = await checkIfUserBlockedMe(otherUserId);
        if (amIBlocked) {
            await showMessagePopup('Cannot Start Chat', 'This user has blocked you. You cannot start a chat with them.');
            return;
        }
        
        const otherUserAccount = await getUserAccount(otherUserId);
        if (otherUserAccount && otherUserAccount.profile && otherUserAccount.profile.privacy) {
            if (otherUserAccount.profile.privacy.allowChats === false) {
                await showMessagePopup('Cannot Start Chat', 'This user has disabled chat requests.');
                return;
            }
        }
        
        const chatId = generateChatId(currentUserUid, otherUserId);
        openChatPopup();
        
        // Create chat if it doesn't exist
        const chatRef = ref(db, `chats/userChats/${chatId}`);
        const chatSnap = await get(chatRef);
        
        if (!chatSnap.exists()) {
            await set(chatRef, {
                participants: {
                    user1: currentUserUid,
                    user2: otherUserId
                },
                createdAt: new Date().toISOString(),
                lastMessage: null,
                lastMessageTime: null,
                lastMessageSender: null
            });
        }
        
        // Load the chat
        await loadChat(chatId, otherUserId, otherUsername);
    }

    async function loadChat(chatId, otherUserId, otherUsername) {
        if (!currentUserUid) return;
        
        currentChatId = chatId;
        currentChatOtherUser = {
            uid: otherUserId,
            username: otherUsername
        };
        
        chatHeaderUsername.textContent = otherUsername || 'User';
        chatHeaderStatus.textContent = 'Online';
        viewProfileInChatBtn.style.display = 'inline-block';
        blockUserInChatBtn.style.display = 'inline-block';
        
        chatMessageInput.disabled = false;
        sendChatMessageBtn.disabled = false;
        chatMessageInput.focus();
        
        chatMessagesContainer.innerHTML = '<div class="chat-loading">Loading messages...</div>';
        
        // Load existing messages
        await loadChatMessages(chatId);
        
        setupChatListener(chatId);
    }

    async function loadChatMessages(chatId) {
        const messagesRef = ref(db, `chats/userChats/${chatId}/messages`);
        const messagesSnap = await get(messagesRef);
        
        chatMessagesContainer.innerHTML = '';
        
        if (!messagesSnap.exists()) {
            chatMessagesContainer.innerHTML = '<div class="chat-empty">No messages yet. Start the conversation!</div>';
            return;
        }
        
        const messages = [];
        messagesSnap.forEach(childSnap => {
            const message = childSnap.val();
            message._id = childSnap.key;
            messages.push(message);
        });
        
        messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        messages.forEach(message => {
            addMessageToChat(message, false);
        });
        
        setTimeout(() => {
            chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
        }, 100);
    }

    function setupChatListener(chatId) {
        if (chatListeners[chatId]) {
            chatListeners[chatId]();
        }
        
        const messagesRef = ref(db, `chats/userChats/${chatId}/messages`);
        
        chatListeners[chatId] = onChildAdded(messagesRef, (snapshot) => {
            if (snapshot.exists()) {
                const message = snapshot.val();
                message._id = snapshot.key;
                
                if (!document.querySelector(`[data-message-id="${message._id}"]`)) {
                    addMessageToChat(message, false);
                    
                    setTimeout(() => {
                        chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
                    }, 100);
                    
                    updateChatListItem(chatId, message);
                }
            }
        });
    }

    function addMessageToChat(message, isNew = true) {
        const isCurrentUser = message.senderId === currentUserUid;
        const isBot = message.senderId === 'BOT';
        const timestamp = new Date(message.timestamp);
        const timeString = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        let messageHTML = '';
        
        if (isBot) {
            messageHTML = `
                <div class="chat-message bot-message" data-message-id="${message._id}">
                    <div class="message-avatar">
                        <i class="fas fa-shield-alt"></i>
                    </div>
                    <div class="message-content">
                        <div class="message-header">
                            <span class="message-sender">ogwXbet Notification System</span>
                            <span class="message-time">${timeString}</span>
                        </div>
                        <div class="message-text">${message.text}</div>
                    </div>
                </div>
            `;
        } else if (isCurrentUser) {
            messageHTML = `
                <div class="chat-message user-message" data-message-id="${message._id}">
                    <div class="message-content">
                        <div class="message-time-right">${timeString}</div>
                        <div class="message-text">${message.text}</div>
                    </div>
                </div>
            `;
        } else {
            messageHTML = `
                <div class="chat-message other-message" data-message-id="${message._id}">
                    <div class="message-avatar">
                        <i class="fas fa-user"></i>
                    </div>
                    <div class="message-content">
                        <div class="message-header">
                            <span class="message-sender">${currentChatOtherUser?.username || 'User'}</span>
                            <span class="message-time">${timeString}</span>
                        </div>
                        <div class="message-text">${message.text}</div>
                    </div>
                </div>
            `;
        }
        
        if (isNew) {
            chatMessagesContainer.insertAdjacentHTML('beforeend', messageHTML);
        } else {
            if (!document.querySelector(`[data-message-id="${message._id}"]`)) {
                chatMessagesContainer.insertAdjacentHTML('beforeend', messageHTML);
            }
        }
    }

    async function sendMessage() {
        if (!currentChatId || !currentUserUid || !currentChatOtherUser) {
            console.error('No active chat or user');
            return;
        }
        
        const messageText = chatMessageInput.value.trim();
        if (!messageText) return;
        
        // Check if blocked
        const isBlocked = await checkIfBlocked(currentChatOtherUser.uid);
        if (isBlocked) {
            await showMessagePopup('Cannot Send Message', 'You have blocked this user. Unblock them first to send messages.');
            return;
        }
        
        const amIBlocked = await checkIfUserBlockedMe(currentChatOtherUser.uid);
        if (amIBlocked) {
            await showMessagePopup('Cannot Send Message', 'This user has blocked you. You cannot send messages to them.');
            return;
        }
        
        // Create message object
        const message = {
            text: messageText,
            senderId: currentUserUid,
            timestamp: new Date().toISOString(),
            read: false
        };
        
        // Add to Firebase
        const messagesRef = ref(db, `chats/userChats/${currentChatId}/messages`);
        const newMessageRef = push(messagesRef);
        
        try {
            await set(newMessageRef, message);
            
            // Update chat last message
            const chatRef = ref(db, `chats/userChats/${currentChatId}`);
            await update(chatRef, {
                lastMessage: messageText,
                lastMessageTime: new Date().toISOString(),
                lastMessageSender: currentUserUid
            });
            
            // Add message to UI immediately
            message._id = newMessageRef.key;
            addMessageToChat(message, true);
            
            // Clear input
            chatMessageInput.value = '';
            chatMessageInput.focus();
            
            // Scroll to bottom
            setTimeout(() => {
                chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
            }, 100);
            
        } catch (error) {
            console.error('Failed to send message:', error);
            await showMessagePopup('Error', 'Failed to send message. Please try again.');
        }
    }

    async function loadChatList() {
        if (!currentUserUid) return;
        
        // Clear loading state
        chatListContainer.innerHTML = '';
        
        // Load announcements first
        await loadAnnouncements();
        
        // Get all chats where current user is a participant
        const userChatsRef = ref(db, 'chats/userChats');
        const chatsSnap = await get(userChatsRef);
        
        if (!chatsSnap.exists()) {
            // Show empty state
            chatListContainer.innerHTML = '<div class="chat-list-empty">No conversations</div>';
            return;
        }
        
        const chats = [];
        chatsSnap.forEach(childSnap => {
            const chat = childSnap.val();
            const chatId = childSnap.key;
            
            // Check if current user is a participant
            if (chat.participants && 
                (chat.participants.user1 === currentUserUid || chat.participants.user2 === currentUserUid)) {
                
                const otherUserId = chat.participants.user1 === currentUserUid ? 
                    chat.participants.user2 : chat.participants.user1;
                
                chats.push({
                    id: chatId,
                    otherUserId: otherUserId,
                    lastMessage: chat.lastMessage || '',
                    lastMessageTime: chat.lastMessageTime || chat.createdAt,
                    lastMessageSender: chat.lastMessageSender
                });
            }
        });
        
        // Sort by last message time (newest first)
        chats.sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime));
        
        // Get user info for each chat
        const chatItems = await Promise.all(chats.map(async (chat) => {
            // Skip if blocked
            const isBlocked = await checkIfBlocked(chat.otherUserId);
            if (isBlocked) return null;
            
            const userAccount = await getUserAccount(chat.otherUserId);
            if (!userAccount) return null;
            
            return {
                ...chat,
                otherUsername: userAccount.username,
                profile: userAccount.profile || {}
            };
        }));
        
        // Filter out null (blocked users)
        const filteredChats = chatItems.filter(chat => chat !== null);
        
        if (filteredChats.length === 0) {
            // Remove announcements item if it exists
            const announcementsItem = chatListContainer.querySelector('.announcements-item');
            if (!announcementsItem) {
                chatListContainer.innerHTML = '<div class="chat-list-empty">No conversations</div>';
            }
            return;
        }
        
        // Display chat list
        let html = '';
        filteredChats.forEach(chat => {
            const lastMessageTime = chat.lastMessageTime ? 
                formatMessageTime(new Date(chat.lastMessageTime)) : 'Just now';
            const isLastMessageFromMe = chat.lastMessageSender === currentUserUid;
            const lastMessagePreview = chat.lastMessage ? 
                (isLastMessageFromMe ? `You: ${chat.lastMessage}` : chat.lastMessage) : 'No messages yet';
            
            // Truncate long messages
            const truncatedMessage = lastMessagePreview.length > 30 ? 
                lastMessagePreview.substring(0, 30) + '...' : lastMessagePreview;
            
            html += `
                <div class="chat-list-item" data-chat-id="${chat.id}" data-user-id="${chat.otherUserId}" data-username="${chat.otherUsername}">
                    <div class="chat-item-avatar">
                        <i class="fas fa-user"></i>
                    </div>
                    <div class="chat-item-info">
                        <div class="chat-item-username">${chat.otherUsername}</div>
                        <div class="chat-item-preview">${truncatedMessage}</div>
                    </div>
                    <div class="chat-item-time">${lastMessageTime}</div>
                </div>
            `;
        });
        
        // Add to chat list
        chatListContainer.insertAdjacentHTML('beforeend', html);
        
        // Add click listeners
        document.querySelectorAll('.chat-list-item').forEach(item => {
            item.addEventListener('click', function() {
                const chatId = this.getAttribute('data-chat-id');
                const userId = this.getAttribute('data-user-id');
                const username = this.getAttribute('data-username');
                
                // Remove active class from all items
                document.querySelectorAll('.chat-list-item').forEach(i => {
                    i.classList.remove('active');
                });
                
                // Add active class to clicked item
                this.classList.add('active');
                
                // Load the chat
                loadChat(chatId, userId, username);
            });
        });
        
        // Set up real-time listener for chat list updates
        setupChatListListener();
    }

    function setupChatListListener() {
        // Remove existing listener
        if (chatListListener) {
            chatListListener();
        }
        
        const userChatsRef = ref(db, 'chats/userChats');
        chatListListener = onChildAdded(userChatsRef, async (snapshot) => {
            if (!snapshot.exists()) return;
            
            const chat = snapshot.val();
            const chatId = snapshot.key;
            
            // Check if current user is a participant
            if (chat.participants && 
                (chat.participants.user1 === currentUserUid || chat.participants.user2 === currentUserUid)) {
                
                const otherUserId = chat.participants.user1 === currentUserUid ? 
                    chat.participants.user2 : chat.participants.user1;
                
                // Check if already in list
                if (document.querySelector(`[data-chat-id="${chatId}"]`)) return;
                
                // Check if blocked
                const isBlocked = await checkIfBlocked(otherUserId);
                if (isBlocked) return;
                
                // Get user info
                const userAccount = await getUserAccount(otherUserId);
                if (!userAccount) return;
                
                // Add to chat list
                addChatToList(chatId, otherUserId, userAccount.username, chat);
            }
        });
    }

    function addChatToList(chatId, otherUserId, username, chat) {
        const lastMessageTime = chat.lastMessageTime ? 
            formatMessageTime(new Date(chat.lastMessageTime)) : 'Just now';
        const isLastMessageFromMe = chat.lastMessageSender === currentUserUid;
        const lastMessagePreview = chat.lastMessage ? 
            (isLastMessageFromMe ? `You: ${chat.lastMessage}` : chat.lastMessage) : 'No messages yet';
        
        const truncatedMessage = lastMessagePreview.length > 30 ? 
            lastMessagePreview.substring(0, 30) + '...' : lastMessagePreview;
        
        const chatItemHTML = `
            <div class="chat-list-item" data-chat-id="${chatId}" data-user-id="${otherUserId}" data-username="${username}">
                <div class="chat-item-avatar">
                    <i class="fas fa-user"></i>
                </div>
                <div class="chat-item-info">
                    <div class="chat-item-username">${username}</div>
                    <div class="chat-item-preview">${truncatedMessage}</div>
                </div>
                <div class="chat-item-time">${lastMessageTime}</div>
            </div>
        `;
        
        // Remove empty state if present
        const emptyState = chatListContainer.querySelector('.chat-list-empty');
        if (emptyState) {
            emptyState.remove();
        }
        
        // Add to chat list
        chatListContainer.insertAdjacentHTML('beforeend', chatItemHTML);
        
        // Add click listener to new item
        const newItem = chatListContainer.querySelector(`[data-chat-id="${chatId}"]`);
        newItem.addEventListener('click', function() {
            const chatId = this.getAttribute('data-chat-id');
            const userId = this.getAttribute('data-user-id');
            const username = this.getAttribute('data-username');
            
            document.querySelectorAll('.chat-list-item').forEach(i => {
                i.classList.remove('active');
            });
            this.classList.add('active');
            loadChat(chatId, userId, username);
        });
    }

    function updateChatListItem(chatId, message) {
        const chatItem = document.querySelector(`[data-chat-id="${chatId}"]`);
        if (!chatItem) return;
        
        const timeElement = chatItem.querySelector('.chat-item-time');
        const previewElement = chatItem.querySelector('.chat-item-preview');
        
        if (timeElement) {
            timeElement.textContent = formatMessageTime(new Date(message.timestamp));
        }
        
        if (previewElement) {
            const isFromMe = message.senderId === currentUserUid;
            const preview = isFromMe ? `You: ${message.text}` : message.text;
            const truncated = preview.length > 30 ? preview.substring(0, 30) + '...' : preview;
            previewElement.textContent = truncated;
        }
        
        // Move to top (but keep announcements at top)
        const announcementsItem = chatListContainer.querySelector('.announcements-item');
        if (announcementsItem && announcementsItem.nextSibling) {
            announcementsItem.parentNode.insertBefore(chatItem, announcementsItem.nextSibling);
        } else {
            chatListContainer.prepend(chatItem);
        }
    }

    function formatMessageTime(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        
        return date.toLocaleDateString();
    }

    // ===== ANNOUNCEMENTS SYSTEM =====
    async function loadAnnouncements() {
        if (!currentUserUid) return;
        
        const announcementsRef = ref(db, 'chats/announcements/messages');
        const snap = await get(announcementsRef);
        
        if (!snap.exists()) return;
        
        // Check if we have an announcements chat in our list
        let hasAnnouncements = false;
        const chatItems = document.querySelectorAll('.chat-list-item');
        chatItems.forEach(item => {
            if (item.getAttribute('data-user-id') === 'BOT') {
                hasAnnouncements = true;
            }
        });
        
        if (!hasAnnouncements) {
            // Add announcements to chat list
            const announcementItemHTML = `
                <div class="chat-list-item announcements-item" data-chat-id="announcements" data-user-id="BOT" data-username="Announcements">
                    <div class="chat-item-avatar" style="background: linear-gradient(135deg, var(--warning), #ff9800);">
                        <i class="fas fa-bullhorn"></i>
                    </div>
                    <div class="chat-item-info">
                        <div class="chat-item-username" style="display: flex; align-items: center; gap: 8px;">
                            Announcements
                            <span style="font-size: 0.7rem; background: var(--secondary); color: var(--text-secondary); padding: 2px 6px; border-radius: 10px;">pinned</span>
                        </div>
                        <div class="chat-item-preview">System announcements and updates</div>
                    </div>
                </div>
            `;
            
            // Remove empty state if present
            const emptyState = chatListContainer.querySelector('.chat-list-empty');
            if (emptyState) {
                emptyState.remove();
            }
            
            chatListContainer.insertAdjacentHTML('afterbegin', announcementItemHTML);
            
            // Add click listener
            const announcementItem = chatListContainer.querySelector('.announcements-item');
            announcementItem.addEventListener('click', function() {
                loadAnnouncementsChat();
            });
        }
    }

    async function loadAnnouncementsChat() {
        currentChatId = 'announcements';
        currentChatOtherUser = {
            uid: 'BOT',
            username: 'Announcements'
        };
        
        chatHeaderUsername.textContent = 'Announcements';
        chatHeaderStatus.textContent = 'Pinned • System Broadcasts';
        viewProfileInChatBtn.style.display = 'none';
        blockUserInChatBtn.style.display = 'none';
        
        // Disable message input for bot
        chatMessageInput.disabled = true;
        sendChatMessageBtn.disabled = true;
        chatMessageInput.placeholder = 'You cannot reply to system messages';
        
        // Clear messages
        chatMessagesContainer.innerHTML = '<div class="chat-loading">Loading announcements...</div>';
        
        // Load announcements
        const announcementsRef = ref(db, 'chats/announcements/messages');
        const snap = await get(announcementsRef);
        
        chatMessagesContainer.innerHTML = '';
        
        if (!snap.exists()) {
            chatMessagesContainer.innerHTML = '<div class="chat-empty">No announcements yet.</div>';
            return;
        }
        
        const announcements = [];
        snap.forEach(childSnap => {
            const message = childSnap.val();
            message._id = childSnap.key;
            announcements.push(message);
        });
        
        // Sort by timestamp (newest first for announcements)
        announcements.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        // Display announcements
        announcements.forEach(message => {
            const timestamp = new Date(message.timestamp);
            const timeString = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const dateString = timestamp.toLocaleDateString();
            
            const messageHTML = `
                <div class="chat-message bot-message" data-message-id="${message._id}">
                    <div class="message-avatar" style="background: linear-gradient(135deg, var(--warning), #ff9800);">
                        <i class="fas fa-bullhorn"></i>
                    </div>
                    <div class="message-content">
                        <div class="message-header">
                            <span class="message-sender">System Broadcast</span>
                            <span class="message-time">${dateString} ${timeString}</span>
                        </div>
                        <div class="message-text">${message.text}</div>
                        ${message.sentBy ? `<div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 5px;">Sent by: ${message.sentBy}</div>` : ''}
                    </div>
                </div>
            `;
            
            chatMessagesContainer.insertAdjacentHTML('beforeend', messageHTML);
        });
        
        // Set up listener for new announcements
        setupAnnouncementsListener();
    }

    function setupAnnouncementsListener() {
        // Remove existing announcement listener
        if (chatListeners['announcements']) {
            chatListeners['announcements']();
        }
        
        const announcementsRef = ref(db, 'chats/announcements/messages');
        
        chatListeners['announcements'] = onChildAdded(announcementsRef, (snapshot) => {
            if (snapshot.exists() && currentChatId === 'announcements') {
                const message = snapshot.val();
                message._id = snapshot.key;
                
                if (!document.querySelector(`[data-message-id="${message._id}"]`)) {
                    const timestamp = new Date(message.timestamp);
                    const timeString = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const dateString = timestamp.toLocaleDateString();
                    
                    const messageHTML = `
                        <div class="chat-message bot-message" data-message-id="${message._id}">
                            <div class="message-avatar" style="background: linear-gradient(135deg, var(--warning), #ff9800);">
                                <i class="fas fa-bullhorn"></i>
                            </div>
                            <div class="message-content">
                                <div class="message-header">
                                    <span class="message-sender">System Broadcast</span>
                                    <span class="message-time">${dateString} ${timeString}</span>
                                </div>
                                <div class="message-text">${message.text}</div>
                                ${message.sentBy ? `<div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 5px;">Sent by: ${message.sentBy}</div>` : ''}
                            </div>
                        </div>
                    `;
                    
                    chatMessagesContainer.insertAdjacentHTML('beforeend', messageHTML);
                }
            }
        });
    }

    // ===== BLOCKING SYSTEM (FIXED) =====
    async function blockUser(userId, username) {
        if (!currentUserUid || !userId || userId === currentUserUid) return;
        
        const confirmBlock = await showConfirmPopup(
            'Block User',
            `Are you sure you want to block ${username}? This will remove your chat with them.`,
            'Block',
            'Cancel'
        );
        
        if (!confirmBlock) return;
        
        try {
            // Add to blocked list with proper structure
            const blockRef = ref(db, `blocks/${currentUserUid}/blockedUsers/${userId}`);
            await set(blockRef, {
                blockedAt: new Date().toISOString(),
                username: username,
                timestamp: Date.now()
            });
            
            // Delete chat if exists
            const chatId = generateChatId(currentUserUid, userId);
            const chatRef = ref(db, `chats/userChats/${chatId}`);
            await remove(chatRef);
            
            // If currently viewing this chat, close it
            if (currentChatOtherUser && currentChatOtherUser.uid === userId) {
                chatMessagesContainer.innerHTML = '<div class="chat-empty">User blocked. Chat removed.</div>';
                chatHeaderUsername.textContent = 'Select a conversation';
                chatHeaderStatus.textContent = 'Click on a conversation to start chatting';
                chatMessageInput.disabled = true;
                sendChatMessageBtn.disabled = true;
                viewProfileInChatBtn.style.display = 'none';
                blockUserInChatBtn.style.display = 'none';
                currentChatId = null;
                currentChatOtherUser = null;
            }
            
            // Remove from chat list
            const chatItem = document.querySelector(`[data-user-id="${userId}"]`);
            if (chatItem) {
                chatItem.remove();
            }
            
            // Update chat list display
            const remainingChats = chatListContainer.querySelectorAll('.chat-list-item:not(.announcements-item)');
            if (remainingChats.length === 0) {
                const announcementsItem = chatListContainer.querySelector('.announcements-item');
                if (!announcementsItem) {
                    chatListContainer.innerHTML = '<div class="chat-list-empty">No conversations</div>';
                }
            }
            
            await showMessagePopup('User Blocked', `${username} has been blocked.`);
            
        } catch (error) {
            console.error('Failed to block user:', error);
            await showMessagePopup('Error', 'Failed to block user. Please try again.');
        }
    }

    async function unblockUser(userId, username) {
        if (!currentUserUid || !userId) return;
        
        const confirmUnblock = await showConfirmPopup(
            'Unblock User',
            `Are you sure you want to unblock ${username}?`,
            'Unblock',
            'Cancel'
        );
        
        if (!confirmUnblock) return;
        
        try {
            const blockRef = ref(db, `blocks/${currentUserUid}/blockedUsers/${userId}`);
            await remove(blockRef);
            
            await showMessagePopup('User Unblocked', `${username} has been unblocked.`);
            
        } catch (error) {
            console.error('Failed to unblock user:', error);
            await showMessagePopup('Error', 'Failed to unblock user. Please try again.');
        }
    }

    async function checkIfBlocked(userId) {
        if (!currentUserUid || !userId) return false;
        
        try {
            const blockRef = ref(db, `blocks/${currentUserUid}/blockedUsers/${userId}`);
            const snap = await get(blockRef);
            return snap.exists();
        } catch (error) {
            console.error('Error checking block status:', error);
            return false;
        }
    }

    async function checkIfUserBlockedMe(userId) {
        if (!currentUserUid || !userId) return false;
        
        try {
            const blockRef = ref(db, `blocks/${userId}/blockedUsers/${currentUserUid}`);
            const snap = await get(blockRef);
            return snap.exists();
        } catch (error) {
            console.error('Error checking if user blocked me:', error);
            return false;
        }
    }

    // ===== HELPER FUNCTIONS =====
    async function getUserAccount(userId) {
        try {
            const accountRef = ref(db, `accounts/${userId}`);
            const snap = await get(accountRef);
            if (snap.exists()) {
                const account = snap.val();
                account.uid = userId;
                return account;
            }
            return null;
        } catch (error) {
            console.error('Error getting user account:', error);
            return null;
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

    function isCurrentUserModerator() {
        return !!(currentAccount && currentAccount.isModerator);
    }

    function showStatus(element, message, type) {
        if (!element) return;
        element.textContent = message;
        element.className = `status ${type}`;
        setTimeout(() => {
            element.className = 'status';
        }, 3000);
    }

    // ===== ACCOUNT FUNCTIONS =====
    async function createAccount() {
        const username = document.getElementById('username').value.trim();
        const webhook = document.getElementById('webhook').value.trim();

        if (!username) {
            showStatus(statusMessage, 'Please enter a username', 'error');
            return;
        }
        if (!webhook) {
            showStatus(statusMessage, 'Please enter a Discord webhook URL', 'error');
            return;
        }
        if (!webhook.startsWith('https://discord.com/api/webhooks/')) {
            showStatus(statusMessage, 'Please enter a valid Discord webhook URL', 'error');
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
                        allowChats: true
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
                showStatus(statusMessage, 'Account created, but failed to send token to Discord. Check your webhook.', 'error');
            } else {
                showStatus(statusMessage, 'Account created successfully! Token sent to your Discord.', 'success');
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
                showStatus(statusMessage, 'Username already taken. Please choose a different one.', 'error');
            } else {
                showStatus(statusMessage, 'Failed to create account. Please try again later.', 'error');
            }
        }
    }

    async function login() {
        const username = document.getElementById('login-username').value.trim();
        const token = document.getElementById('login-token').value.trim();

        if (!username || !token) {
            showStatus(loginStatus, 'Please enter both username and token', 'error');
            return;
        }

        const email = `${username}@ogwxbet.local`;

        try {
            await signInWithEmailAndPassword(auth, email, token);
            showStatus(loginStatus, 'Login successful! Redirecting to dashboard...', 'success');
        } catch (error) {
            console.error('Login error:', error);
            showStatus(loginStatus, 'Invalid username or token. Please try again.', 'error');
        }
    }

    async function logout() {
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
    }

    async function changeToken() {
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
            showStatus(tokenStatus, 'Token generation cancelled.', 'info');
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
                showStatus(tokenStatus, 'Token generation cancelled.', 'info');
                return;
            }
            if (!newWebhook.startsWith('https://discord.com/api/webhooks/')) {
                showStatus(tokenStatus, 'Invalid webhook URL.', 'error');
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

            if (response.ok) {
                showStatus(tokenStatus, 'New token generated and sent to Discord.', 'success');
            } else {
                showStatus(tokenStatus, 'Token updated, but sending to Discord failed.', 'error');
            }
        } catch (err) {
            console.error('Token regen error:', err);
            showStatus(tokenStatus, 'Failed to update token. Try re-logging and retry.', 'error');
        }
    }

    // ===== PROFILE FUNCTIONS =====
    function updateProfilePicture() {
        const pictureUrl = document.getElementById('profile-picture-url').value.trim();
        const preview = document.getElementById('profile-picture-preview');
        const placeholder = document.getElementById('profile-picture-placeholder');
        
        if (!pictureUrl) {
            preview.style.display = 'none';
            placeholder.style.display = 'flex';
            showStatus(profileStatus, 'Picture removed. Using placeholder.', 'info');
            return;
        }

        if (!pictureUrl.startsWith('http')) {
            showStatus(profileStatus, 'Please enter a valid URL starting with http:// or https://', 'error');
            return;
        }

        preview.onerror = function() {
            preview.style.display = 'none';
            placeholder.style.display = 'flex';
            showStatus(profileStatus, 'Failed to load image from this URL. Using placeholder.', 'error');
        };
        
        preview.onload = function() {
            preview.style.display = 'block';
            placeholder.style.display = 'none';
            showStatus(profileStatus, 'Picture updated successfully!', 'success');
        };
        
        preview.src = pictureUrl;
    }

    async function saveProfileSettings() {
        if (!currentAccount || !currentUserUid) return;

        profileStatus.textContent = '';
        profileStatus.className = 'status';

        try {
            const pictureUrl = document.getElementById('profile-picture-url').value.trim();
            const bio = document.getElementById('user-bio').value.trim();
            const showReputation = document.getElementById('privacy-reputation').checked;
            const showBets = document.getElementById('privacy-bets').checked;
            const showPredictions = document.getElementById('privacy-predictions').checked;
            const allowChats = document.getElementById('privacy-chats').checked;

            currentAccount.profile = {
                picture: pictureUrl,
                bio: bio,
                privacy: {
                    showReputation: showReputation,
                    showBets: showBets,
                    showPredictions: showPredictions,
                    allowChats: allowChats
                }
            };

            await set(ref(db, `accounts/${currentUserUid}`), currentAccount);

            await set(ref(db, `userSearch/${currentUserUid}`), {
                username: currentAccount.username,
                creationDate: currentAccount.creationDate,
                profile: currentAccount.profile
            });

            showStatus(profileStatus, 'Profile settings saved successfully!', 'success');

        } catch (err) {
            console.error('Failed to save profile settings:', err);
            showStatus(profileStatus, 'Failed to save profile settings. Please try again.', 'error');
        }
    }

    // ===== SEARCH FUNCTIONS =====
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
            const snap = await get(userSearchRef);
            const results = [];

            if (snap.exists()) {
                snap.forEach(childSnap => {
                    const userData = childSnap.val() || {};
                    if (userData.username && userData.username.toLowerCase().includes(searchTerm)) {
                        results.push({
                            uid: childSnap.key,
                            ...userData
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

    // ===== ADMIN FUNCTIONS =====
    async function sendBroadcastMessage() {
        if (!isCurrentUserModerator()) return;
        
        const message = broadcastMessageInput.value.trim();
        if (!message) {
            await showMessagePopup('Error', 'Please enter a message to broadcast.');
            return;
        }
        
        const confirmSend = await showConfirmPopup(
            'Confirm Broadcast',
            'Are you sure you want to broadcast this message to all users?',
            'Yes, Broadcast',
            'Cancel'
        );
        
        if (!confirmSend) return;
        
        try {
            const broadcastMessage = {
                text: message,
                senderId: 'BOT',
                timestamp: new Date().toISOString(),
                isBroadcast: true,
                sentBy: currentAccount.username
            };
            
            const announcementsRef = ref(db, 'chats/announcements/messages');
            await push(announcementsRef, broadcastMessage);
            
            broadcastMessageInput.value = '';
            await showMessagePopup('Broadcast Sent', 'Message sent to all users successfully!');
            
        } catch (error) {
            console.error('Failed to send broadcast:', error);
            await showMessagePopup('Error', 'Failed to send broadcast. Please try again.');
        }
    }

    async function updateAdminInfo() {
        if (!currentAccount || !currentAccount.isModerator) return;

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

        document.getElementById('accounts-table-body').innerHTML =
            activeAccountsHTML ||
            `
            <tr>
                <td colspan="4" style="text-align: center; color: var(--text-secondary);">No active accounts found</td>
            </tr>
        `;

        document.getElementById('deleted-accounts-table-body').innerHTML =
            deletedAccountsHTML ||
            `
            <tr>
                <td colspan="5" style="text-align: center; color: var(--text-secondary);">No deleted accounts found</td>
            </tr>
        `;

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

    async function deleteAccount(uid, username) {
        if (!isCurrentUserModerator()) return;

        const confirmDelete = await showConfirmPopup(
            'Delete Account',
            `Delete account "${username}"?`,
            'Delete Account',
            'Cancel'
        );

        if (!confirmDelete) return;

        try {
            const updates = {
                deleted: true,
                deletedAt: new Date().toISOString(),
                deletedBy: currentAccount.username || 'Unknown Moderator'
            };

            await update(ref(db, `accounts/${uid}`), updates);
            await remove(ref(db, `userSearch/${uid}`));

            await showMessagePopup('Account Deleted', `Account "${username}" has been deleted.`);
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
            `Restore account "${username}"?`,
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

            const updates = {
                deleted: false,
                deletedAt: null,
                deletedBy: null
            };

            await update(ref(db, `accounts/${uid}`), updates);

            await set(ref(db, `userSearch/${uid}`), {
                username: accountData.username,
                creationDate: accountData.creationDate,
                profile: accountData.profile || {}
            });

            await showMessagePopup('Account Restored', `Account "${username}" has been restored.`);
            updateAdminInfo();

        } catch (err) {
            console.error('Failed to restore account:', err);
            await showMessagePopup('Error', 'Failed to restore account. Please try again.');
        }
    }

    async function clearEventLog() {
        if (!isCurrentUserModerator()) return;

        const confirmClear = await showConfirmPopup(
            'Clear Event Log',
            'Clear the entire event log?',
            'Clear Log',
            'Cancel'
        );
        if (!confirmClear) return;

        try {
            await set(eventLogRef, null);
            showStatus(eventLogStatus, 'Event log cleared.', 'success');
        } catch (err) {
            showStatus(eventLogStatus, 'Failed to clear event log.', 'error');
        }

        setTimeout(() => {
            eventLogStatus.className = 'status';
        }, 3000);
    }

    // ===== EVENT FUNCTIONS =====
    window.saveEventToFirebase = function (eventObj) {
        const newRef = push(eventsRef);
        set(newRef, eventObj);
    };

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

    function addEvent() {
        const title = document.getElementById('event-title').value.trim();
        const teamA = document.getElementById('team-a').value.trim();
        const teamB = document.getElementById('team-b').value.trim();
        const date = document.getElementById('event-date').value;
        const category = document.getElementById('event-category').value;

        if (!title || !teamA || !teamB || !date) {
            const eventStatus = document.getElementById('event-status');
            showStatus(eventStatus, 'Please fill in all fields', 'error');
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

        const eventStatus = document.getElementById('event-status');
        showStatus(eventStatus, 'Event added successfully!', 'success');

        document.getElementById('event-title').value = '';
        document.getElementById('team-a').value = '';
        document.getElementById('team-b').value = '';
        document.getElementById('event-date').value = '';
    }

    // ===== PREDICTION FUNCTIONS =====
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

    // ===== DISPLAY FUNCTIONS =====
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
                      <strong>Your Prediction:</strong> ${userPrediction.choice === 'A' ? event.teamA : event.teamB} 
                      <span style="margin-left: 8px;">
                          ${userPrediction.correct ? '✓ Correct' : '✗ Wrong'}
                      </span>
                   </div>`
                : '';

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

    // ===== PAGE MANAGEMENT =====
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
        if (toggleTokenBtn) {
            toggleTokenBtn.querySelector('i').className = 'fas fa-eye';
        }
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

        const profile = currentAccount.profile || {};
        const privacy = profile.privacy || {};

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
        if (bioInput) {
            bioInput.value = profile.bio || '';
        }

        const reputationCheckbox = document.getElementById('privacy-reputation');
        const betsCheckbox = document.getElementById('privacy-bets');
        const predictionsCheckbox = document.getElementById('privacy-predictions');
        const chatsCheckbox = document.getElementById('privacy-chats');
        
        if (reputationCheckbox) reputationCheckbox.checked = privacy.showReputation !== false;
        if (betsCheckbox) betsCheckbox.checked = privacy.showBets !== false;
        if (predictionsCheckbox) predictionsCheckbox.checked = privacy.showPredictions !== false;
        if (chatsCheckbox) chatsCheckbox.checked = privacy.allowChats !== false;

        renderPredictionsList(currentAccount);
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
                    showStatus(profileStatus, 'Account data refreshed successfully!', 'success');
                }
            }
        } catch (err) {
            console.error('Failed to refresh account data:', err);
            if (profileStatus) {
                showStatus(profileStatus, 'Failed to refresh data. Please try again.', 'error');
            }
        }
    }

    // ===== EVENT HANDLERS =====
    function loadEvents() {
        try {
            const events = window.latestEvents || [];
            window.displayFirebaseEvents(events);
        } catch (error) {
            console.log('Error loading events');
        }
    }

    // ===== EVENT LISTENERS =====
    showRegisterBtn.addEventListener('click', function () {
        loginSection.classList.add('hidden');
        accountCreationSection.classList.remove('hidden');
    });

    showLoginBtn.addEventListener('click', function () {
        accountCreationSection.classList.add('hidden');
        loginSection.classList.remove('hidden');
    });

    if (toggleTokenBtn) {
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
    }

    if (createAccountBtn) createAccountBtn.addEventListener('click', createAccount);
    if (loginBtn) loginBtn.addEventListener('click', login);
    if (logoutBtn) logoutBtn.addEventListener('click', logout);
    if (changeTokenBtn) changeTokenBtn.addEventListener('click', changeToken);
    if (addEventBtn) addEventBtn.addEventListener('click', addEvent);
    if (clearEventLogBtn) clearEventLogBtn.addEventListener('click', clearEventLog);
    if (updatePictureBtn) updatePictureBtn.addEventListener('click', updateProfilePicture);
    if (saveProfileBtn) saveProfileBtn.addEventListener('click', saveProfileSettings);
    if (searchUserBtn) searchUserBtn.addEventListener('click', searchUsers);
    if (refreshPredictionsBtn) refreshPredictionsBtn.addEventListener('click', refreshAccountData);
    if (closeProfilePopup) closeProfilePopup.addEventListener('click', closeUserProfilePopup);

    // Chat event listeners
    if (openChatBtn) openChatBtn.addEventListener('click', openChatPopup);
    if (closeChatBtn) closeChatBtn.addEventListener('click', closeChatPopup);
    if (sendChatMessageBtn) sendChatMessageBtn.addEventListener('click', sendMessage);
    if (chatMessageInput) {
        chatMessageInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }
    if (viewProfileInChatBtn) {
        viewProfileInChatBtn.addEventListener('click', function () {
            if (currentChatOtherUser && currentChatOtherUser.uid !== 'BOT') {
                closeChatPopup();
                openUserProfilePopup({
                    uid: currentChatOtherUser.uid,
                    username: currentChatOtherUser.username
                });
            }
        });
    }
    if (blockUserInChatBtn) {
        blockUserInChatBtn.addEventListener('click', async function () {
            if (currentChatOtherUser && currentChatOtherUser.uid !== 'BOT') {
                // Close chat popup first to fix layering
                closeChatPopup();
                // Small delay to ensure popup is closed
                await new Promise(resolve => setTimeout(resolve, 50));
                await blockUser(currentChatOtherUser.uid, currentChatOtherUser.username);
            }
        });
    }
    if (adminBroadcastBtn) {
        adminBroadcastBtn.addEventListener('click', function () {
            if (isCurrentUserModerator()) {
                const broadcastSection = document.getElementById('broadcast-section');
                broadcastSection.classList.toggle('hidden');
            }
        });
    }
    if (sendBroadcastBtn) sendBroadcastBtn.addEventListener('click', sendBroadcastMessage);

    // Remove new chat button if it exists
    if (newChatBtn) {
        newChatBtn.style.display = 'none';
        newChatBtn.remove();
    }

    // Close popups when clicking outside
    if (chatPopup) {
        chatPopup.addEventListener('click', function (e) {
            if (e.target === chatPopup) {
                closeChatPopup();
            }
        });
    }
    if (userProfilePopup) {
        userProfilePopup.addEventListener('click', function (e) {
            if (e.target === userProfilePopup) {
                closeUserProfilePopup();
            }
        });
    }

    // Tab navigation
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

    // Event delegation for moderator menu and predictions
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

    // ===== EVENT MENU HANDLING =====
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
                `Who won "${eventObj.title}"?`,
                [
                    { label: eventObj.teamA, value: 'A' },
                    { label: eventObj.teamB, value: 'B' }
                ]
            );
            if (!winnerChoice) return;

            await resolveEventPredictions(eventObj, winnerChoice);

            await showMessagePopup('Predictions Resolved', 'Event ended! Reputation has been awarded.');
            
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
            `Delete "${eventObj.title}"?`,
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

            const updates = {};

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
            await showMessagePopup('Event Ended', 'This event has already ended.');
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
                `Switch to ${choice === 'A' ? eventObj.teamA : eventObj.teamB}?`,
                'Switch',
                'Keep Current'
            );
            
            if (!confirmSwitch) {
                return;
            }
            
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
            const choice = btn.getAttribute('data-choice');
            if (choice === selectedChoice) {
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

    // ===== AUTH STATE HANDLER =====
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
                            'This account has been deleted by moderators.'
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

    // ===== INITIALIZATION =====
    checkLoginStatus();

    // ===== EVENT LOG RENDERER =====
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
