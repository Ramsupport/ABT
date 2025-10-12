// Agreement Manager - Authentication Logic

const API_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:3000' 
    : window.location.origin;

// Check if already logged in
if (localStorage.getItem('token')) {
    window.location.href = '/app.html';
}

// Tab switching
function switchTab(tab) {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const tabs = document.querySelectorAll('.tab-btn');

    if (tab === 'login') {
        loginForm.classList.add('active');
        registerForm.classList.remove('active');
        tabs[0].classList.add('active');
        tabs[1].classList.remove('active');
    } else {
        registerForm.classList.add('active');
        loginForm.classList.remove('active');
        tabs[1].classList.add('active');
        tabs[0].classList.remove('active');
    }
    hideMessage();
}

// Show message
function showMessage(message, type = 'error') {
    const messageBox = document.getElementById('messageBox');
    messageBox.textContent = message;
    messageBox.className = `message-box ${type}`;
    messageBox.style.display = 'block';
    
    if (type === 'success') {
        setTimeout(() => {
            messageBox.style.display = 'none';
        }, 3000);
    }
}

function hideMessage() {
    const messageBox = document.getElementById('messageBox');
    messageBox.style.display = 'none';
}

// Login
async function handleLogin(e) {
    e.preventDefault();
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Logging in...';
    submitBtn.disabled = true;
    
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;

    try {
        const response = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            showMessage('Login successful! Redirecting...', 'success');
            setTimeout(() => {
                window.location.href = '/app.html';
            }, 1000);
        } else {
            showMessage(data.error || 'Invalid username or password', 'error');
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    } catch (error) {
        console.error('Login error:', error);
        showMessage('Connection error. Please try again.', 'error');
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}

// Register
async function handleRegister(e) {
    e.preventDefault();
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Creating account...';
    submitBtn.disabled = true;
    
    const fullName = document.getElementById('regFullName').value.trim();
    const username = document.getElementById('regUsername').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;

    // Validation
    if (username.length < 3) {
        showMessage('Username must be at least 3 characters', 'error');
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
        return;
    }

    if (password.length < 6) {
        showMessage('Password must be at least 6 characters', 'error');
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password, fullName })
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            showMessage('Account created! Redirecting...', 'success');
            setTimeout(() => {
                window.location.href = '/app.html';
            }, 1000);
        } else {
            showMessage(data.error || 'Registration failed', 'error');
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    } catch (error) {
        console.error('Registration error:', error);
        showMessage('Connection error. Please try again.', 'error');
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}

console.log('✅ Auth system loaded');
console.log('🌐 API URL:', API_URL);