document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const loginView = document.getElementById('login-view');
    const registerView = document.getElementById('register-view');
    
    const linkShowRegister = document.getElementById('link-show-register');
    const linkShowLogin = document.getElementById('link-show-login');
    
    const formLogin = document.getElementById('form-login');
    const formRegister = document.getElementById('form-register');
    
    const authAlert = document.getElementById('auth-alert');
    
    const loginUsernameInput = document.getElementById('login-username');
    const loginPasswordInput = document.getElementById('login-password');
    const registerUsernameInput = document.getElementById('register-username');
    const registerPasswordInput = document.getElementById('register-password');

    // Toggle to Register form
    linkShowRegister.addEventListener('click', () => {
        hideAlert();
        loginView.style.display = 'none';
        registerView.style.display = 'block';
        formLogin.reset();
    });

    // Toggle to Login form
    linkShowLogin.addEventListener('click', () => {
        hideAlert();
        registerView.style.display = 'none';
        loginView.style.display = 'block';
        formRegister.reset();
    });

    // Handle Login Submit
    formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideAlert();

        const username = loginUsernameInput.value.trim();
        const password = loginPasswordInput.value;

        try {
            const response = await fetch('/api/faculty/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok) {
                sessionStorage.setItem('faculty_authenticated', 'true');
                sessionStorage.setItem('faculty_username', username);
                showAlert('Login successful! Redirecting...', 'success');
                setTimeout(() => {
                    window.location.href = 'faculty.html';
                }, 800);
            } else {
                showAlert(data.error || 'Authentication failed.', 'error');
            }
        } catch (err) {
            console.error('Login error:', err);
            showAlert('Server network error. Please try again.', 'error');
        }
    });

    // Handle Registration Submit
    formRegister.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideAlert();

        const username = registerUsernameInput.value.trim();
        const password = registerPasswordInput.value;

        try {
            const response = await fetch('/api/faculty/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok) {
                showAlert('Faculty registered successfully! Please login below.', 'success');
                setTimeout(() => {
                    // Switch to login card
                    registerView.style.display = 'none';
                    loginView.style.display = 'block';
                    formRegister.reset();
                    loginUsernameInput.value = username;
                    loginPasswordInput.focus();
                }, 1500);
            } else {
                showAlert(data.error || 'Registration failed.', 'error');
            }
        } catch (err) {
            console.error('Registration error:', err);
            showAlert('Server network error. Please try again.', 'error');
        }
    });

    // Helper alerts functions
    function showAlert(message, type) {
        authAlert.textContent = message;
        authAlert.style.display = 'block';
        authAlert.className = `auth-alert auth-alert-${type}`;
    }

    function hideAlert() {
        authAlert.style.display = 'none';
        authAlert.textContent = '';
    }

    updateNavigationVisibility();
});

function updateNavigationVisibility() {
    const navAdmin = document.getElementById('nav-admin');
    const navFaculty = document.getElementById('nav-faculty');
    const navStudent = document.getElementById('nav-student');

    const isAdmin = sessionStorage.getItem('admin_authenticated') === 'true';
    const isFaculty = sessionStorage.getItem('faculty_authenticated') === 'true';

    if (navAdmin) navAdmin.style.display = 'none';

    if (isAdmin) {
        if (navAdmin) navAdmin.style.display = 'inline-block';
        if (navFaculty) navFaculty.style.display = 'inline-block';
        if (navStudent) navStudent.style.display = 'inline-block';
    } else if (isFaculty) {
        if (navAdmin) navAdmin.style.display = 'none';
        if (navFaculty) navFaculty.style.display = 'inline-block';
        if (navStudent) navStudent.style.display = 'none';
    } else {
        // On faculty authentication portal, show both options, keep admin hidden
        if (navAdmin) navAdmin.style.display = 'none';
        if (navFaculty) navFaculty.style.display = 'inline-block';
        if (navStudent) navStudent.style.display = 'inline-block';
    }
}
