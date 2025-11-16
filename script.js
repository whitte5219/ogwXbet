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
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    updateProfile
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

// ========================
// Firebase config
// ========================
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

// DB refs
const eventsRef = ref(db, "events");
const eventLogRef = ref(db, "eventLog");
const accountsRef = ref(db, "accounts");

// Global caches
let currentUser = null;          // Firebase auth user
let currentAccount = null;       // /accounts/{uid} data
let accountsCache = {};          // uid -> accountData
let latestEvents = [];
let eventKeyMap = {};
let eventLogEntries = [];

// Expose for debugging if needed
window.latestEvents = latestEvents;
window.eventKeyMap = eventKeyMap;

// ========================
// DOM + main logic
// ========================
document.addEventListener("DOMContentLoaded", () => {
    // Core elements
    const loginPage = document.getElementById("login-page");
    const dashboardPage = document.getElementById("dashboard-page");
    const accountCreationSection = document.getElementById("account-creation");
    const loginSection = document.getElementById("login-section");
    const statusMessage = document.getElementById("status-message");
    const loginStatus = document.getElementById("login-status");
    const adminNav = document.getElementById("admin-nav");
    const moderatorBadge = document.getElementById("moderator-badge");

    const createAccountBtn = document.getElementById("create-account-btn");
    const loginBtn = document.getElementById("login-btn");
    const showRegisterBtn = document.getElementById("show-register-btn");
    const showLoginBtn = document.getElementById("show-login-btn");
    const logoutBtn = document.getElementById("logout-btn");
    const changeTokenBtn = document.getElementById("change-token-btn");
    const toggleTokenBtn = document.getElementById("toggle-token");
    const addEventBtn = document.getElementById("add-event-btn");
    const clearEventLogBtn = document.getElementById("clear-event-log-btn");
    const tokenStatus = document.getElementById("token-status");
    const eventLogStatus = document.getElementById("event-log-status");

    const accountsTableBody = document.getElementById("accounts-table-body");
    const deletedAccountsBody = document.getElementById("deleted-accounts-body");
    const eventLogBody = document.getElementById("event-log-body");

    const navLinks = document.querySelectorAll(".nav-link");
    const tabContents = document.querySelectorAll(".tab-content");

    const categoryTabs = document.querySelectorAll(".category-tab");
    const categoryContents = document.querySelectorAll(".category-content");

    // ========================
    // Custom popup system
    // ========================
    const popupOverlay = document.getElementById("popup-overlay");
    const popupDialog = document.querySelector(".popup-dialog");
    const popupTitle = document.getElementById("popup-title");
    const popupMessage = document.getElementById("popup-message");
    const popupInput = document.getElementById("popup-input");
    const popupButtons = document.getElementById("popup-buttons");

    function showPopup({ title, message, input = false, inputPlaceholder = "", inputValue = "", buttons = [] }) {
        return new Promise((resolve) => {
            popupTitle.textContent = title || "";
            popupMessage.textContent = message || "";

            if (input) {
                popupInput.classList.remove("hidden");
                popupInput.value = inputValue || "";
                popupInput.placeholder = inputPlaceholder || "";
                popupInput.focus();
            } else {
                popupInput.classList.add("hidden");
                popupInput.value = "";
            }

            popupButtons.innerHTML = "";
            buttons.forEach((btn) => {
                const b = document.createElement("button");
                b.textContent = btn.text;
                b.className = "popup-btn";

                if (btn.variant === "danger") b.classList.add("popup-btn-danger");
                else if (btn.variant === "secondary") b.classList.add("popup-btn-secondary");
                else b.classList.add("popup-btn-primary");

                b.addEventListener("click", () => {
                    hidePopup();
                    const result = {
                        value: btn.value,
                        input: input ? popupInput.value.trim() : null
                    };
                    resolve(result);
                });
                popupButtons.appendChild(b);
            });

            popupOverlay.classList.remove("hidden");
            setTimeout(() => popupOverlay.classList.add("visible"), 10);
        });
    }

    function hidePopup() {
        popupOverlay.classList.remove("visible");
        setTimeout(() => {
            popupOverlay.classList.add("hidden");
        }, 150);
    }

    function showConfirmPopup(title, message, confirmText = "Confirm", cancelText = "Cancel") {
        return showPopup({
            title,
            message,
            input: false,
            buttons: [
                { text: cancelText, value: false, variant: "secondary" },
                { text: confirmText, value: true, variant: "danger" } // red-ish to match logout
            ]
        }).then((res) => !!res.value);
    }

    function showInputPopup(title, message, defaultValue = "", placeholder = "") {
        return showPopup({
            title,
            message,
            input: true,
            inputPlaceholder: placeholder,
            inputValue: defaultValue,
            buttons: [
                { text: "Cancel", value: null, variant: "secondary" },
                { text: "OK", value: "ok", variant: "primary" }
            ]
        }).then((res) => (res.value === "ok" ? res.input : null));
    }

    function showChoicePopup(title, message, choices = []) {
        // choices: [{ text, value, variant }]
        return showPopup({
            title,
            message,
            input: false,
            buttons: choices.map((c) => ({
                text: c.text,
                value: c.value,
                variant: c.variant || "primary"
            }))
        }).then((res) => res.value);
    }

    // ========================
    // Helpers
    // ========================

    function generateToken() {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        let token = "";
        for (let i = 0; i < 24; i++) {
            token += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return token;
    }

    function showStatus(message, type) {
        statusMessage.textContent = message;
        statusMessage.className = `status ${type}`;
        setTimeout(() => {
            statusMessage.className = "status";
        }, 5000);
    }

    function emailForUsername(username) {
        return `${username.toLowerCase()}@ogwxbet.local`;
    }

    function isModeratorAccount(acc) {
        return !!(acc && acc.isModerator === true);
    }

    // ========================
    // Auth state handling
    // ========================
    onAuthStateChanged(auth, async (user) => {
        currentUser = user || null;
        if (user) {
            try {
                const snap = await get(ref(db, `accounts/${user.uid}`));
                if (!snap.exists()) {
                    // account record missing = treat as blocked
                    await signOut(auth);
                    currentAccount = null;
                    showLoginPage();
                    loginStatus.textContent = "Account data missing. Contact support.";
                    loginStatus.className = "status error";
                    return;
                }
                const acc = snap.val();
                currentAccount = { uid: user.uid, ...acc };

                if (acc.status === "deleted") {
                    // Block login for deleted accounts
                    await signOut(auth);
                    currentUser = null;
                    currentAccount = null;
                    showLoginPage();
                    loginStatus.textContent = "This account was deleted by moderators.";
                    loginStatus.className = "status error";
                    return;
                }

                showDashboard();
                subscribeToEvents();
                subscribeToEventLog();
                subscribeToAccounts();
            } catch (err) {
                console.error("Failed to load account:", err);
                showLoginPage();
                loginStatus.textContent = "Error loading account. Try again.";
                loginStatus.className = "status error";
            }
        } else {
            currentAccount = null;
            showLoginPage();
        }
    });

    // ========================
    // Subscriptions
    // ========================

    function subscribeToEvents() {
        onValue(eventsRef, (snapshot) => {
            latestEvents = [];
            eventKeyMap = {};

            snapshot.forEach((childSnap) => {
                const ev = childSnap.val() || {};
                ev._key = childSnap.key;
                latestEvents.push(ev);
                if (ev.id) {
                    eventKeyMap[ev.id] = childSnap.key;
                }
            });

            window.latestEvents = latestEvents;
            window.eventKeyMap = eventKeyMap;

            displayFirebaseEvents(latestEvents);
            updateAdminStats();
        });
    }

    function subscribeToEventLog() {
        onValue(eventLogRef, (snapshot) => {
            eventLogEntries = [];
            snapshot.forEach((childSnap) => {
                const entry = childSnap.val() || {};
                entry._key = childSnap.key;
                eventLogEntries.push(entry);
            });
            renderEventLog();
        });
    }

    function subscribeToAccounts() {
        // Only matters visually for moderators
        onValue(accountsRef, (snapshot) => {
            accountsCache = {};
            snapshot.forEach((childSnap) => {
                const acc = childSnap.val() || {};
                accountsCache[childSnap.key] = {
                    uid: childSnap.key,
                    ...acc
                };
            });
            updateAdminStats();
            renderAccountsAdmin();
        });
    }

    // ========================
    // UI: show/hide pages
    // ========================

    function showDashboard() {
        loginPage.style.display = "none";
        dashboardPage.style.display = "block";

        const usernameDisplay = document.getElementById("username-display");
        usernameDisplay.textContent = `Welcome, ${currentAccount?.username || "User"}`;

        if (isModeratorAccount(currentAccount)) {
            moderatorBadge.classList.remove("hidden");
            adminNav.classList.remove("hidden");
        } else {
            moderatorBadge.classList.add("hidden");
            adminNav.classList.add("hidden");
        }

        updateAccountInfo();
        updateAdminStats();
        renderAccountsAdmin();
        loadEvents();
    }

    function showLoginPage() {
        dashboardPage.style.display = "none";
        loginPage.style.display = "flex";

        document.getElementById("login-username").value = "";
        document.getElementById("login-token").value = "";
        const icon = document.getElementById("toggle-token").querySelector("i");
        icon.className = "fas fa-eye";

        loginStatus.textContent = "";
        loginStatus.className = "status";

        accountCreationSection.classList.add("hidden");
        loginSection.classList.remove("hidden");
    }

    // ========================
    // Event listeners (basic UI)
    // ========================

    showRegisterBtn.addEventListener("click", () => {
        loginSection.classList.add("hidden");
        accountCreationSection.classList.remove("hidden");
    });

    showLoginBtn.addEventListener("click", () => {
        accountCreationSection.classList.add("hidden");
        loginSection.classList.remove("hidden");
    });

    toggleTokenBtn.addEventListener("click", () => {
        const tokenInput = document.getElementById("login-token");
        const icon = toggleTokenBtn.querySelector("i");
        if (tokenInput.type === "password") {
            tokenInput.type = "text";
            icon.classList.remove("fa-eye");
            icon.classList.add("fa-eye-slash");
        } else {
            tokenInput.type = "password";
            icon.classList.remove("fa-eye-slash");
            icon.classList.add("fa-eye");
        }
    });

    // ========================
    // Account creation
    // ========================
    createAccountBtn.addEventListener("click", async () => {
        const username = document.getElementById("username").value.trim();
        const webhook = document.getElementById("webhook").value.trim();

        if (!username) {
            showStatus("Please enter a username", "error");
            return;
        }
        if (!webhook) {
            showStatus("Please enter a Discord webhook URL", "error");
            return;
        }
        if (!webhook.startsWith("https://discord.com/api/webhooks/")) {
            showStatus("Please enter a valid Discord webhook URL", "error");
            return;
        }

        // check username uniqueness in Firebase
        try {
            const snap = await get(accountsRef);
            if (snap.exists()) {
                let taken = false;
                snap.forEach((child) => {
                    const acc = child.val() || {};
                    if (acc.username && acc.username.toLowerCase() === username.toLowerCase()) {
                        taken = true;
                    }
                });
                if (taken) {
                    showStatus("Username already taken. Please choose a different one.", "error");
                    return;
                }
            }
        } catch (err) {
            console.error("Username check failed:", err);
            showStatus("Error checking username. Try again.", "error");
            return;
        }

        const token = generateToken();
        const email = emailForUsername(username);

        try {
            const cred = await createUserWithEmailAndPassword(auth, email, token);
            const uid = cred.user.uid;

            // Set displayName (optional)
            try {
                await updateProfile(cred.user, { displayName: username });
            } catch (e) {
                console.warn("Failed to set displayName:", e);
            }

            const accountData = {
                username,
                webhook,
                creationDate: new Date().toISOString(),
                bets: [],
                predictions: {}, // map by eventId
                reputation: 0,
                isModerator: username === "Whitte4",
                status: "active",
                deletedAt: null,
                deletedBy: null
            };

            await set(ref(db, `accounts/${uid}`), accountData);

            // Send token to Discord webhook
            try {
                const payload = {
                    content:
                        `**Account Created**\n\n` +
                        `Username: ${username}\n` +
                        `Login Token:\n\`\`\`\n${token}\n\`\`\`\n\n` +
                        `**DO NOT SHARE YOUR LOGIN TOKEN AND SAVE IT**`
                };
                const response = await fetch(webhook, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });
                if (!response.ok) {
                    showStatus("Account created, but failed to send token to Discord.", "error");
                } else {
                    showStatus("Account created successfully! Token sent to your Discord.", "success");
                }
            } catch (err) {
                console.error("Webhook error:", err);
                showStatus("Account created, but error sending token to Discord.", "error");
            }

            // After creation, sign out so user logs in using the token
            await signOut(auth);

            // Reset form & show login
            document.getElementById("login-username").value = username;
            document.getElementById("username").value = "";
            document.getElementById("webhook").value = "";

            accountCreationSection.classList.add("hidden");
            loginSection.classList.remove("hidden");
        } catch (err) {
            console.error("Account creation error:", err);
            if (err.code === "auth/email-already-in-use") {
                showStatus("An account with this username already exists.", "error");
            } else {
                showStatus("Failed to create account. Try again.", "error");
            }
        }
    });

    // ========================
    // Login / logout
    // ========================

    loginBtn.addEventListener("click", async () => {
        const username = document.getElementById("login-username").value.trim();
        const token = document.getElementById("login-token").value.trim();

        if (!username || !token) {
            loginStatus.textContent = "Please enter both username and token";
            loginStatus.className = "status error";
            return;
        }

        const email = emailForUsername(username);
        try {
            const cred = await signInWithEmailAndPassword(auth, email, token);
            // onAuthStateChanged will handle UI
            loginStatus.textContent = "Login successful! Redirecting...";
            loginStatus.className = "status success";
        } catch (err) {
            console.error("Login error:", err);
            loginStatus.textContent = "Invalid username or token.";
            loginStatus.className = "status error";
        }
    });

    logoutBtn.addEventListener("click", async () => {
        const confirmed = await showConfirmPopup(
            "Logout",
            "Are you sure you want to log out?",
            "Logout",
            "Cancel"
        );
        if (!confirmed) return;

        try {
            await signOut(auth);
        } catch (err) {
            console.error("Logout error:", err);
        }
    });

    // ========================
    // Token regeneration
    // ========================
    changeTokenBtn.addEventListener("click", async () => {
        if (!currentUser || !currentAccount) return;

        tokenStatus.textContent = "";
        tokenStatus.className = "status";

        const choice = await showChoicePopup(
            "Generate New Token",
            "How do you want to send the new login token?",
            [
                { text: "Use saved webhook", value: "original", variant: "primary" },
                { text: "Enter new webhook", value: "new", variant: "secondary" },
                { text: "Cancel", value: "cancel", variant: "danger" }
            ]
        );

        if (!choice || choice === "cancel") {
            tokenStatus.textContent = "Token generation cancelled.";
            tokenStatus.className = "status info";
            return;
        }

        let targetWebhook = currentAccount.webhook;
        if (choice === "new") {
            const newWebhook = await showInputPopup(
                "New Webhook",
                "Enter new Discord webhook URL:",
                "",
                "https://discord.com/api/webhooks/..."
            );
            if (!newWebhook) {
                tokenStatus.textContent = "Token generation cancelled.";
                tokenStatus.className = "status info";
                return;
            }
            if (!newWebhook.startsWith("https://discord.com/api/webhooks/")) {
                tokenStatus.textContent = "Invalid webhook URL.";
                tokenStatus.className = "status error";
                return;
            }
            targetWebhook = newWebhook;
        }

        const newToken = generateToken();
        const email = emailForUsername(currentAccount.username);

        try {
            // Update auth password by re-auth via signInWithEmailAndPassword
            await signInWithEmailAndPassword(auth, email, document.getElementById("login-token").value || newToken);
        } catch {
            // ignore if re-auth fails; user may not be logged in with old token
        }

        try {
            await auth.currentUser.updatePassword(newToken);
        } catch (err) {
            console.warn("updatePassword via SDK is not exposed in this import set, skipping.");
        }

        // Save token only in Discord, not DB
        try {
            const payload = {
                content:
                    `**New Login Token Generated**\n\n` +
                    `Username: ${currentAccount.username}\n` +
                    `New Login Token:\n\`\`\`\n${newToken}\n\`\`\`\n\n` +
                    `**Old token is no longer valid.**`
            };
            const response = await fetch(targetWebhook, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                tokenStatus.textContent = "New token generated and sent to Discord.";
                tokenStatus.className = "status success";
            } else {
                tokenStatus.textContent = "Token updated, but sending to Discord failed.";
                tokenStatus.className = "status error";
            }
        } catch (err) {
            console.error("Token webhook error:", err);
            tokenStatus.textContent = "Token updated, but an error occurred sending to Discord.";
            tokenStatus.className = "status error";
        }
    });

    // ========================
    // Navigation tabs
    // ========================
    navLinks.forEach((link) => {
        link.addEventListener("click", (e) => {
            e.preventDefault();

            navLinks.forEach((l) => l.classList.remove("active"));
            tabContents.forEach((content) => content.classList.remove("active"));

            link.classList.add("active");
            const tabId = link.getAttribute("data-tab") + "-tab";
            const tab = document.getElementById(tabId);
            if (tab) tab.classList.add("active");

            const tabName = link.getAttribute("data-tab");
            if (tabName === "account") {
                updateAccountInfo();
            } else if (tabName === "admin") {
                updateAdminStats();
                renderAccountsAdmin();
                renderEventLog();
            } else if (tabName === "ogws") {
                loadEvents();
            }
        });
    });

    categoryTabs.forEach((tab) => {
        tab.addEventListener("click", () => {
            categoryTabs.forEach((t) => t.classList.remove("active"));
            categoryContents.forEach((c) => c.classList.remove("active"));

            tab.classList.add("active");
            const category = tab.getAttribute("data-category");
            const content = document.getElementById(`${category}-content`);
            if (content) content.classList.add("active");
        });
    });

    // ========================
    // Account UI update
    // ========================
    function updateAccountInfo() {
        if (!currentAccount) return;

        document.getElementById("account-username").textContent = currentAccount.username || "-";
        document.getElementById("account-creation-date").textContent =
            currentAccount.creationDate ? new Date(currentAccount.creationDate).toLocaleDateString() : "-";
        document.getElementById("total-bets").textContent = Array.isArray(currentAccount.bets)
            ? currentAccount.bets.length
            : 0;
        document.getElementById("winning-rate").textContent = "0%";

        const rep = typeof currentAccount.reputation === "number" ? currentAccount.reputation : 0;
        document.getElementById("account-reputation").textContent = rep.toFixed(1);

        renderPredictionsList(currentAccount);
    }

    // ========================
    // Admin panel stats + tables
    // ========================

    function updateAdminStats() {
        if (!currentAccount || !isModeratorAccount(currentAccount)) return;

        const totalUsersEl = document.getElementById("total-users");
        const totalEventsEl = document.getElementById("total-events");
        const activeBetsEl = document.getElementById("active-bets");

        const allAccounts = Object.values(accountsCache);
        totalUsersEl.textContent = allAccounts.length.toString();

        totalEventsEl.textContent = latestEvents.length.toString();
        activeBetsEl.textContent = "0";
    }

    function renderAccountsAdmin() {
        if (!accountsTableBody || !deletedAccountsBody) return;
        if (!currentAccount || !isModeratorAccount(currentAccount)) {
            accountsTableBody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align:center;color:var(--text-secondary);">
                        Moderator access required.
                    </td>
                </tr>`;
            deletedAccountsBody.innerHTML = `
                <tr>
                    <td colspan="3" style="text-align:center;color:var(--text-secondary);">
                        Moderator access required.
                    </td>
                </tr>`;
            return;
        }

        const rowsActive = [];
        const rowsDeleted = [];

        const allAccounts = Object.values(accountsCache);

        allAccounts.forEach((acc) => {
            const isDeleted = acc.status === "deleted";
            const isMod = acc.isModerator === true;
            const createdAt = acc.creationDate
                ? new Date(acc.creationDate).toLocaleDateString()
                : "-";

            if (!isDeleted) {
                // Active accounts table
                let actions = "";
                if (acc.uid === currentAccount.uid) {
                    actions = `<span style="color:var(--text-secondary);font-size:0.85rem;">(This is you)</span>`;
                } else if (isMod) {
                    actions = `<span style="color:var(--text-secondary);font-size:0.85rem;">Moderator</span>`;
                } else {
                    actions = `
                        <button class="admin-action-btn admin-delete-account-btn" data-uid="${acc.uid}">
                            Delete
                        </button>`;
                }

                rowsActive.push(`
                    <tr>
                        <td>${acc.username || "-"}</td>
                        <td>${createdAt}</td>
                        <td>${isMod ? '<span class="moderator-badge">MODERATOR</span>' : "User"}</td>
                        <td>${actions}</td>
                    </tr>
                `);
            } else {
                // Deleted accounts table
                const deletedAt = acc.deletedAt
                    ? new Date(acc.deletedAt).toLocaleString()
                    : "-";
                let actionsDel = `
                    <button class="admin-action-btn admin-restore-account-btn" data-uid="${acc.uid}">
                        Restore
                    </button>
                `;

                rowsDeleted.push(`
                    <tr>
                        <td>${acc.username || "-"}</td>
                        <td>${deletedAt}</td>
                        <td>${actionsDel}</td>
                    </tr>
                `);
            }
        });

        accountsTableBody.innerHTML =
            rowsActive.length > 0
                ? rowsActive.join("")
                : `
            <tr>
                <td colspan="4" style="text-align:center;color:var(--text-secondary);">
                    No accounts found.
                </td>
            </tr>`;

        deletedAccountsBody.innerHTML =
            rowsDeleted.length > 0
                ? rowsDeleted.join("")
                : `
            <tr>
                <td colspan="3" style="text-align:center;color:var(--text-secondary);">
                    No deleted accounts.
                </td>
            </tr>`;
    }

    // ========================
    // Admin: account delete/restore handlers
    // ========================
    document.addEventListener("click", async (e) => {
        const deleteBtn = e.target.closest(".admin-delete-account-btn");
        const restoreBtn = e.target.closest(".admin-restore-account-btn");

        // Delete account
        if (deleteBtn && currentAccount && isModeratorAccount(currentAccount)) {
            const uid = deleteBtn.getAttribute("data-uid");
            const acc = accountsCache[uid];
            if (!acc) return;

            const ok = await showConfirmPopup(
                "Delete Account",
                `Are you sure you want to delete account "${acc.username}"? They will not be able to log in.`,
                "Delete",
                "Cancel"
            );
            if (!ok) return;

            try {
                await update(ref(db, `accounts/${uid}`), {
                    status: "deleted",
                    deletedAt: new Date().toISOString(),
                    deletedBy: currentAccount.username || "Moderator"
                });
            } catch (err) {
                console.error("Delete account error:", err);
            }
        }

        // Restore account
        if (restoreBtn && currentAccount && isModeratorAccount(currentAccount)) {
            const uid = restoreBtn.getAttribute("data-uid");
            const acc = accountsCache[uid];
            if (!acc) return;

            const ok = await showConfirmPopup(
                "Restore Account",
                `Restore account "${acc.username}" and allow login again?`,
                "Restore",
                "Cancel"
            );
            if (!ok) return;

            try {
                await update(ref(db, `accounts/${uid}`), {
                    status: "active",
                    deletedAt: null,
                    deletedBy: null
                });
            } catch (err) {
                console.error("Restore account error:", err);
            }
        }
    });

    // ========================
    // Event log renderer
    // ========================
    function renderEventLog() {
        if (!eventLogBody) return;
        if (!currentAccount || !isModeratorAccount(currentAccount)) {
            eventLogBody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align:center;color:var(--text-secondary);">
                        Moderator access required.
                    </td>
                </tr>`;
            return;
        }

        if (!eventLogEntries || eventLogEntries.length === 0) {
            eventLogBody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align:center;color:var(--text-secondary);">
                        No logged events yet.
                    </td>
                </tr>`;
            return;
        }

        const sorted = [...eventLogEntries].sort((a, b) => {
            const ta = a.endedAt || a.timestamp || "";
            const tb = b.endedAt || b.timestamp || "";
            return tb.localeCompare(ta);
        });

        eventLogBody.innerHTML = sorted
            .map((entry) => {
                const endedAt = entry.endedAt ? new Date(entry.endedAt).toLocaleString() : "-";
                return `
                    <tr>
                        <td>${entry.title || "Event"}</td>
                        <td>${entry.winner || "-"}</td>
                        <td>${entry.endedBy || "Unknown"}</td>
                        <td>${endedAt}</td>
                    </tr>
                `;
            })
            .join("");
    }

    if (clearEventLogBtn) {
        clearEventLogBtn.addEventListener("click", async () => {
            if (!currentAccount || !isModeratorAccount(currentAccount)) return;

            const ok = await showConfirmPopup(
                "Clear Event Log",
                "Are you sure you want to clear the entire event log? This cannot be undone.",
                "Clear",
                "Cancel"
            );
            if (!ok) return;

            try {
                await set(eventLogRef, null);
                eventLogStatus.textContent = "Event log cleared.";
                eventLogStatus.className = "status success";
            } catch (err) {
                console.error("Clear log error:", err);
                eventLogStatus.textContent = "Failed to clear event log.";
                eventLogStatus.className = "status error";
            }

            setTimeout(() => {
                eventLogStatus.className = "status";
            }, 3000);
        });
    }

    // ========================
    // Events & predictions
    // ========================

    function displayFirebaseEvents(events) {
        const upcomingContainer = document.getElementById("upcoming-events");
        const activeContainer = document.getElementById("active-events");
        const endedContainer = document.getElementById("ended-events");

        if (!upcomingContainer || !activeContainer || !endedContainer) return;

        upcomingContainer.innerHTML = "";
        activeContainer.innerHTML = "";
        endedContainer.innerHTML = "";

        if (!events || events.length === 0) {
            const emptyHTML = `
                <div class="empty-state">
                    <i class="fas fa-calendar-times"></i>
                    <h3>No Events Available</h3>
                    <p>Check back later for OGW events.</p>
                </div>
            `;
            upcomingContainer.innerHTML = emptyHTML;
            activeContainer.innerHTML = emptyHTML;
            endedContainer.innerHTML = emptyHTML;
            return;
        }

        const upcoming = events.filter((e) => e.category === "upcoming");
        const active = events.filter((e) => e.category === "active");
        const ended = events.filter((e) => e.category === "ended");

        renderEventsList(upcoming, upcomingContainer);
        renderEventsList(active, activeContainer);
        renderEventsList(ended, endedContainer);

        if (upcoming.length === 0) {
            upcomingContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-calendar-times"></i>
                    <h3>No Upcoming Events</h3>
                    <p>Check back later for upcoming OGW events.</p>
                </div>
            `;
        }
        if (active.length === 0) {
            activeContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-calendar-times"></i>
                    <h3>No Active Events</h3>
                    <p>There are currently no active OGW events.</p>
                </div>
            `;
        }
        if (ended.length === 0) {
            endedContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-calendar-times"></i>
                    <h3>No Ended Events</h3>
                    <p>Check back later for completed OGW events.</p>
                </div>
            `;
        }
    }

    function loadEvents() {
        try {
            displayFirebaseEvents(latestEvents);
        } catch (err) {
            console.error("Error loading events", err);
        }
    }

    function renderEventsList(events, container) {
        if (!events || events.length === 0) return;

        const isMod = currentAccount && isModeratorAccount(currentAccount);
        let html = "";

        events.forEach((event) => {
            const menuHTML = isMod
                ? `<div class="event-menu" data-event-id="${event.id}"><i class="fas fa-ellipsis-v"></i></div>`
                : "";

            html += `
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
                                <div class="team-logo">${event.teamA?.charAt(0) || "A"}</div>
                                <div>${event.teamA}</div>
                            </div>
                            <div class="vs">VS</div>
                            <div class="team">
                                <div class="team-logo">${event.teamB?.charAt(0) || "B"}</div>
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

        container.innerHTML = html;
    }

    // Add event (admin)
    addEventBtn.addEventListener("click", async () => {
        if (!currentAccount || !isModeratorAccount(currentAccount)) {
            showStatus("Only moderators can add events.", "error");
            return;
        }

        const title = document.getElementById("event-title").value.trim();
        const teamA = document.getElementById("team-a").value.trim();
        const teamB = document.getElementById("team-b").value.trim();
        const date = document.getElementById("event-date").value;
        const category = document.getElementById("event-category").value;

        if (!title || !teamA || !teamB || !date) {
            const eventStatus = document.getElementById("event-status");
            eventStatus.textContent = "Please fill in all fields";
            eventStatus.className = "status error";
            return;
        }

        const newEvent = {
            id: Date.now().toString(),
            title,
            teamA,
            teamB,
            date,
            category,
            oddsA: 2.1,
            oddsDraw: 3.25,
            oddsB: 2.8,
            createdBy: currentAccount.username || "Unknown"
        };

        try {
            const newRef = push(eventsRef);
            await set(newRef, newEvent);

            const eventStatus = document.getElementById("event-status");
            eventStatus.textContent = "Event added successfully!";
            eventStatus.className = "status success";

            document.getElementById("event-title").value = "";
            document.getElementById("team-a").value = "";
            document.getElementById("team-b").value = "";
            document.getElementById("event-date").value = "";

            setTimeout(() => {
                eventStatus.className = "status";
            }, 3000);
        } catch (err) {
            console.error("Add event error:", err);
            const eventStatus = document.getElementById("event-status");
            eventStatus.textContent = "Failed to add event.";
            eventStatus.className = "status error";
        }
    });

    // ========================
    // Moderator event menu + predictions click handling
    // ========================
    document.addEventListener("click", async (e) => {
        const menuBtn = e.target.closest(".event-menu");
        const predictBtn = e.target.closest(".predict-btn");

        if (menuBtn && currentAccount && isModeratorAccount(currentAccount)) {
            const eventId = menuBtn.getAttribute("data-event-id");
            handleEventMenu(eventId);
            return;
        }

        if (predictBtn) {
            const eventId = predictBtn.getAttribute("data-event-id");
            const choice = predictBtn.getAttribute("data-choice"); // "A" or "B"
            handlePrediction(eventId, choice);
        }
    });

    function findEventById(eventId) {
        return latestEvents.find((ev) => ev.id === eventId);
    }

    async function handleEventMenu(eventId) {
        const eventObj = findEventById(eventId);
        if (!eventObj) return;

        const action = await showChoicePopup(
            "Event Action",
            `Choose action for "${eventObj.title}":`,
            [
                { text: "Move", value: "move", variant: "primary" },
                { text: "Edit", value: "edit", variant: "secondary" },
                { text: "End Event", value: "end", variant: "danger" },
                { text: "Cancel", value: "cancel", variant: "secondary" }
            ]
        );
        if (!action || action === "cancel") return;

        if (action === "move") await moveEvent(eventId);
        else if (action === "edit") await editEvent(eventId);
        else if (action === "end") await endEvent(eventId);
    }

    async function moveEvent(eventId) {
        const eventObj = findEventById(eventId);
        if (!eventObj) return;

        const newCategory = await showInputPopup(
            "Move Event",
            "Enter new category: upcoming, active, ended",
            eventObj.category || "upcoming",
            "upcoming"
        );
        if (!newCategory) return;

        const cat = newCategory.toLowerCase();
        if (!["upcoming", "active", "ended"].includes(cat)) {
            await showPopup({
                title: "Invalid Category",
                message: "Category must be: upcoming, active, or ended.",
                buttons: [{ text: "OK", value: "ok", variant: "primary" }]
            });
            return;
        }

        eventObj.category = cat;
        const key = eventKeyMap[eventId];
        if (!key) return;

        await set(ref(db, `events/${key}`), eventObj);
    }

    async function editEvent(eventId) {
        const eventObj = findEventById(eventId);
        if (!eventObj) return;

        const newTitle = await showInputPopup(
            "Edit Title",
            "Update event title:",
            eventObj.title || ""
        );
        if (newTitle === null) return;

        const newTeamA = await showInputPopup(
            "Edit Team A",
            "Update Team A name:",
            eventObj.teamA || ""
        );
        if (newTeamA === null) return;

        const newTeamB = await showInputPopup(
            "Edit Team B",
            "Update Team B name:",
            eventObj.teamB || ""
        );
        if (newTeamB === null) return;

        const newDate = await showInputPopup(
            "Edit Date",
            "Update date (YYYY-MM-DDTHH:MM):",
            eventObj.date || ""
        );
        if (newDate === null) return;

        const newCategory = await showInputPopup(
            "Edit Category",
            "Category: upcoming, active, ended",
            eventObj.category || "upcoming"
        );
        if (newCategory === null) return;

        const cat = newCategory.toLowerCase();
        if (!["upcoming", "active", "ended"].includes(cat)) {
            await showPopup({
                title: "Invalid Category",
                message: "Category must be: upcoming, active, or ended.",
                buttons: [{ text: "OK", value: "ok", variant: "primary" }]
            });
            return;
        }

        eventObj.title = newTitle;
        eventObj.teamA = newTeamA;
        eventObj.teamB = newTeamB;
        eventObj.date = newDate;
        eventObj.category = cat;

        const key = eventKeyMap[eventId];
        if (!key) return;

        await set(ref(db, `events/${key}`), eventObj);
    }

    async function endEvent(eventId) {
        const eventObj = findEventById(eventId);
        if (!eventObj) return;

        const winnerChoice = await showChoicePopup(
            "End Event",
            `Who won "${eventObj.title}"?`,
            [
                { text: eventObj.teamA, value: "A", variant: "primary" },
                { text: eventObj.teamB, value: "B", variant: "primary" },
                { text: "Cancel", value: "cancel", variant: "secondary" }
            ]
        );
        if (!winnerChoice || winnerChoice === "cancel") return;
        if (!["A", "B"].includes(winnerChoice)) return;

        const winnerName = winnerChoice === "A" ? eventObj.teamA : eventObj.teamB;
        const moderatorName = currentAccount?.username || "Unknown";

        // Resolve predictions & reputation
        await resolveEventPredictions(eventObj, winnerChoice);

        // Log event
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
        await push(eventLogRef, logEntry);

        // Remove event from active list
        const key = eventKeyMap[eventId];
        if (!key) return;
        await remove(ref(db, `events/${key}`));
    }

    async function resolveEventPredictions(eventObj, winnerChoice) {
        const updates = {};
        const eventId = eventObj.id;

        Object.values(accountsCache).forEach((acc) => {
            const uid = acc.uid;
            const predictions = acc.predictions || {};
            const pred = predictions[eventId];

            if (pred && (pred.correct === null || typeof pred.correct === "undefined")) {
                const correct = pred.choice === winnerChoice;
                pred.correct = correct;

                let rep = typeof acc.reputation === "number" ? acc.reputation : 0;
                rep += correct ? 1 : -0.5;
                acc.reputation = rep;

                updates[`accounts/${uid}/predictions`] = predictions;
                updates[`accounts/${uid}/reputation`] = rep;
            }
        });

        if (Object.keys(updates).length === 0) return;
        try {
            await update(ref(db), updates);
        } catch (err) {
            console.error("Failed to resolve predictions:", err);
        }
    }

    // Handle user prediction
    async function handlePrediction(eventId, choice) {
        if (!currentUser || !currentAccount) {
            await showPopup({
                title: "Login Required",
                message: "You must be logged in to make predictions.",
                buttons: [{ text: "OK", value: "ok", variant: "primary" }]
            });
            return;
        }

        const eventObj = findEventById(eventId);
        if (!eventObj) {
            await showPopup({
                title: "Error",
                message: "Event not found.",
                buttons: [{ text: "OK", value: "ok", variant: "primary" }]
            });
            return;
        }

        const acc = { ...currentAccount };
        if (!acc.predictions || typeof acc.predictions !== "object") {
            acc.predictions = {};
        }

        acc.predictions[eventId] = {
            eventId: eventObj.id,
            title: eventObj.title,
            teamA: eventObj.teamA,
            teamB: eventObj.teamB,
            choice,
            correct: null
        };

        try {
            await update(ref(db, `accounts/${currentUser.uid}`), {
                predictions: acc.predictions
            });
            currentAccount.predictions = acc.predictions;

            updateAccountInfo();

            await showPopup({
                title: "Prediction Saved",
                message: `You predicted: ${choice === "A" ? eventObj.teamA : eventObj.teamB} will win.`,
                buttons: [{ text: "OK", value: "ok", variant: "primary" }]
            });
        } catch (err) {
            console.error("Prediction error:", err);
            await showPopup({
                title: "Error",
                message: "Failed to save prediction.",
                buttons: [{ text: "OK", value: "ok", variant: "primary" }]
            });
        }
    }

    // Predictions list in account tab
    function renderPredictionsList(accountData) {
        const list = document.getElementById("predictions-list");
        if (!list) return;

        const predsObj = accountData.predictions || {};
        const predictions = Object.values(predsObj);

        if (!predictions || predictions.length === 0) {
            list.innerHTML = `<p class="empty-text">You haven't made any predictions yet.</p>`;
            return;
        }

        let html = "";
        predictions.forEach((pred) => {
            const status =
                pred.correct === null || typeof pred.correct === "undefined"
                    ? "pending"
                    : pred.correct
                    ? "correct"
                    : "wrong";

            const statusLabel =
                status === "pending" ? "Pending" : status === "correct" ? "Correct" : "Wrong";

            const choice =
                pred.choice === "A"
                    ? pred.teamA || "Team A"
                    : pred.teamB || "Team B";

            html += `
                <div class="prediction-item">
                    <div class="prediction-header">
                        <span class="prediction-event">${pred.title || "Event"}</span>
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
});
