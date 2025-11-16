// Firebase imports (module)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getDatabase, ref, onValue, push, set } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

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
const eventsRef = ref(db, "events");

// Save new event to Firebase
window.saveEventToFirebase = function(eventObj) {
    const newRef = push(eventsRef);
    set(newRef, eventObj);
};

// Subscribe to events in Firebase
onValue(eventsRef, snapshot => {
    const data = snapshot.val() || {};
    const events = Object.values(data);
    window.latestEvents = events;
    if (window.displayFirebaseEvents) {
        window.displayFirebaseEvents(events);
    }
});

// Initialize with fresh data (accounts only, events are now in Firebase)
const initializeData = () => {
    const whitte4Account = {
        token: 'Whitte4ModToken123',
        creationDate: new Date().toISOString(),
        webhook: 'https://discord.com/api/webhooks/sample',
        bets: [],
        isModerator: true
    };
    localStorage.setItem('ogwXbet_Whitte4', JSON.stringify(whitte4Account));
};

if (!localStorage.getItem('ogwXbet_Whitte4')) {
    initializeData();
}

document.addEventListener('DOMContentLoaded', function() {
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
    
    checkLoginStatus();
    
    showRegisterBtn.addEventListener('click', function() {
        loginSection.classList.add('hidden');
        accountCreationSection.classList.remove('hidden');
    });
    
    showLoginBtn.addEventListener('click', function() {
        accountCreationSection.classList.add('hidden');
        loginSection.classList.remove('hidden');
    });
    
    toggleTokenBtn.addEventListener('click', function() {
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
    
    createAccountBtn.addEventListener('click', async function() {
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
        if (localStorage.getItem(`ogwXbet_${username}`)) {
            showStatus('Username already taken. Please choose a different one.', 'error');
            return;
        }
        
        const token = generateToken();
        const accountData = {
            token: token,
            creationDate: new Date().toISOString(),
            webhook: webhook,
            bets: [],
            isModerator: username === 'Whitte4'
        };
        localStorage.setItem(`ogwXbet_${username}`, JSON.stringify(accountData));
        
        try {
            const payload = {
                content: `**Account Created**\n\nUsername: ${username}\nLogin Token:\n\`\`\`\n${token}\n\`\`\`\n\n**DO NOT SHARE YOUR LOGIN TOKEN AND SAVE IT**`
            };
            const response = await fetch(webhook, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (response.ok) {
                showStatus('Account created successfully! Token sent to your Discord.', 'success');
                accountCreationSection.classList.add('hidden');
                loginSection.classList.remove('hidden');
                document.getElementById('login-username').value = username;
                document.getElementById('username').value = '';
                document.getElementById('webhook').value = '';
            } else {
                showStatus('Failed to send token. Please check your webhook URL.', 'error');
            }
        } catch (error) {
            showStatus('Error sending to webhook. Please check your connection.', 'error');
        }
    });
    
    loginBtn.addEventListener('click', function() {
        const username = document.getElementById('login-username').value.trim();
        const token = document.getElementById('login-token').value.trim();
        
        if (!username || !token) {
            loginStatus.textContent = 'Please enter both username and token';
            loginStatus.className = 'status error';
            return;
        }
        
        const accountData = getAccountData(username);
        if (!accountData) {
            loginStatus.textContent = 'Account not found. Please create an account first.';
            loginStatus.className = 'status error';
            return;
        }
        if (accountData.token !== token) {
            loginStatus.textContent = 'Invalid token. Please check and try again.';
            loginStatus.className = 'status error';
            return;
        }
        
        loginStatus.textContent = 'Login successful! Redirecting to dashboard...';
        loginStatus.className = 'status success';
        
        sessionStorage.setItem('ogwXbet_currentUser', username);
        sessionStorage.setItem('ogwXbet_loginTime', new Date().getTime());
        
        setTimeout(() => {
            showDashboard(username, accountData.isModerator);
        }, 1000);
    });
    
    logoutBtn.addEventListener('click', function() {
        sessionStorage.removeItem('ogwXbet_currentUser');
        sessionStorage.removeItem('ogwXbet_loginTime');
        showLoginPage();
    });
    
    changeTokenBtn.addEventListener('click', function() {
        const username = sessionStorage.getItem('ogwXbet_currentUser');
        if (!username) return;
        const accountData = getAccountData(username);
        if (!accountData) return;
        
        const newToken = generateToken();
        accountData.token = newToken;
        localStorage.setItem(`ogwXbet_${username}`, JSON.stringify(accountData));
        
        document.getElementById('token-status').textContent = 'New token generated successfully!';
        document.getElementById('token-status').className = 'status success';
    });
    
    addEventBtn.addEventListener('click', function() {
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
            createdBy: sessionStorage.getItem('ogwXbet_currentUser')
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
    
    const navLinks = document.querySelectorAll('.nav-link');
    const tabContents = document.querySelectorAll('.tab-content');
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
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
        tab.addEventListener('click', function() {
            categoryTabs.forEach(t => t.classList.remove('active'));
            categoryContents.forEach(content => content.classList.remove('active'));
            
            this.classList.add('active');
            const category = this.getAttribute('data-category');
            document.getElementById(`${category}-content`).classList.add('active');
        });
    });
    
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
    
    function getAccountData(username) {
        try {
            const data = localStorage.getItem(`ogwXbet_${username}`);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            return null;
        }
    }
    
    function checkLoginStatus() {
        const currentUser = sessionStorage.getItem('ogwXbet_currentUser');
        const loginTime = sessionStorage.getItem('ogwXbet_loginTime');
        
        if (currentUser && loginTime) {
            const now = new Date().getTime();
            const sessionDuration = 24 * 60 * 60 * 1000;
            
            if (now - parseInt(loginTime) < sessionDuration) {
                const accountData = getAccountData(currentUser);
                if (accountData) {
                    showDashboard(currentUser, accountData.isModerator);
                    return;
                }
            }
        }
        showLoginPage();
    }
    
    function showDashboard(username, isModerator) {
        loginPage.style.display = 'none';
        dashboardPage.style.display = 'block';
        document.getElementById('username-display').textContent = `Welcome, ${username}`;
        
        if (isModerator) {
            moderatorBadge.classList.remove('hidden');
            adminNav.classList.remove('hidden');
        }
        
        loadEvents();
        updateAdminInfo();
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
        const username = sessionStorage.getItem('ogwXbet_currentUser');
        if (!username) return;
        const accountData = getAccountData(username);
        if (!accountData) return;
        
        document.getElementById('account-username').textContent = username;
        document.getElementById('account-creation-date').textContent = new Date(accountData.creationDate).toLocaleDateString();
        document.getElementById('total-bets').textContent = accountData.bets ? accountData.bets.length : 0;
        document.getElementById('winning-rate').textContent = '0%';
    }
    
    function updateAdminInfo() {
        let userCount = 0;
        let accountsHTML = '';
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('ogwXbet_') && key !== 'ogwXbet_events') {
                try {
                    userCount++;
                    const username = key.replace('ogwXbet_', '');
                    const accountData = getAccountData(username);
                    if (!accountData) continue;
                    
                    accountsHTML += `
                        <tr>
                            <td>${username}</td>
                            <td>${new Date(accountData.creationDate).toLocaleDateString()}</td>
                            <td>${accountData.isModerator ? '<span class="moderator-badge">MODERATOR</span>' : 'User'}</td>
                        </tr>
                    `;
                } catch (error) {
                    console.log('Skipping invalid account data');
                }
            }
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
        
        document.getElementById('accounts-table-body').innerHTML = accountsHTML || `
            <tr>
                <td colspan="3" style="text-align: center; color: var(--text-secondary);">No accounts found</td>
            </tr>
        `;
    }
    
    window.displayFirebaseEvents = function(events) {
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
        let eventsHTML = '';
        
        events.forEach(event => {
            eventsHTML += `
                <div class="event-card">
                    <div class="event-header">
                        <h3 class="event-title">${event.title}</h3>
                        <div class="event-date">Starts: ${new Date(event.date).toLocaleString()}</div>
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
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = eventsHTML;
    }
});
