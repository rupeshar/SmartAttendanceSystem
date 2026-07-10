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
    const nav = document.querySelector('header nav');

    const isAdmin = sessionStorage.getItem('admin_authenticated') === 'true';
    const isFaculty = sessionStorage.getItem('faculty_authenticated') === 'true';
    const isStudent = !!localStorage.getItem('attendance_student_roll');
    
    const isStudentPage = window.location.pathname.includes('student.html');
    const isFacultyPage = window.location.pathname.includes('faculty.html') || window.location.pathname.includes('faculty-auth.html');

    if (navAdmin) navAdmin.style.display = 'none';

    if (isAdmin) {
        if (navAdmin) navAdmin.style.display = 'inline-block';
        if (navFaculty) navFaculty.style.display = 'inline-block';
        if (navStudent) navStudent.style.display = 'inline-block';
    } else if (isFaculty || isFacultyPage) {
        if (navAdmin) navAdmin.style.display = 'none';
        if (navFaculty) navFaculty.style.display = 'inline-block';
        if (navStudent) navStudent.style.display = 'none';
    } else if (isStudentPage && isStudent) {
        if (navAdmin) navAdmin.style.display = 'none';
        if (navFaculty) navFaculty.style.display = 'none';
        if (navStudent) navStudent.style.display = 'inline-block';
    } else {
        if (navAdmin) navAdmin.style.display = 'none';
        if (navFaculty) navFaculty.style.display = 'inline-block';
        if (navStudent) navStudent.style.display = 'inline-block';
    }

    if (nav) {
        let navLogout = document.getElementById('nav-logout');
        const anyUserLoggedIn = isAdmin || isFaculty || (isStudentPage && isStudent);
        
        if (anyUserLoggedIn) {
            if (!navLogout) {
                navLogout = document.createElement('a');
                navLogout.id = 'nav-logout';
                navLogout.href = '#';
                navLogout.style.color = '#ef4444';
                navLogout.style.fontWeight = '600';
                navLogout.textContent = 'Logout';
                navLogout.addEventListener('click', (e) => {
                    e.preventDefault();
                    if (isAdmin) {
                        sessionStorage.removeItem('admin_authenticated');
                        sessionStorage.removeItem('admin_token');
                        fetch('/api/admin/logout', { method: 'POST' }).finally(() => {
                            window.location.href = 'index.html';
                        });
                    } else if (isFaculty) {
                        sessionStorage.removeItem('faculty_authenticated');
                        sessionStorage.removeItem('faculty_username');
                        window.location.href = 'index.html';
                    } else if (isStudent) {
                        localStorage.removeItem('attendance_student_roll');
                        localStorage.removeItem('attendance_student_name');
                        localStorage.removeItem('attendance_student_email');
                        localStorage.removeItem('attendance_student_passport');
                        window.location.href = 'index.html';
                    }
                });
                nav.appendChild(navLogout);
            }
        } else {
            if (navLogout) {
                navLogout.remove();
            }
        }
    }
}
