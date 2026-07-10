document.addEventListener('DOMContentLoaded', () => {
    const formLogin = document.getElementById('form-admin-login');
    const authAlert = document.getElementById('auth-alert');
    const usernameInput = document.getElementById('admin-username');
    const passwordInput = document.getElementById('admin-password');

    formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideAlert();

        const username = usernameInput.value.trim();
        const password = passwordInput.value;

        try {
            const response = await fetch('/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok) {
                sessionStorage.setItem('admin_authenticated', 'true');
                showAlert('Login successful! Loading Admin Panel...', 'success');
                setTimeout(() => {
                    window.location.href = 'admin.html';
                }, 800);
            } else {
                showAlert(data.error || 'Invalid credentials.', 'error');
            }
        } catch (err) {
            console.error('Admin Login error:', err);
            showAlert('Server network error. Please try again.', 'error');
        }
    });

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
    const isStudent = !!localStorage.getItem('attendance_student_roll');

    if (navAdmin) navAdmin.style.display = 'none';

    if (isAdmin) {
        if (navAdmin) navAdmin.style.display = 'inline-block';
        if (navFaculty) navFaculty.style.display = 'inline-block';
        if (navStudent) navStudent.style.display = 'inline-block';
    } else if (isFaculty) {
        if (navAdmin) navAdmin.style.display = 'none';
        if (navFaculty) navFaculty.style.display = 'inline-block';
        if (navStudent) navStudent.style.display = 'none';
    } else if (isStudent) {
        if (navAdmin) navAdmin.style.display = 'none';
        if (navFaculty) navFaculty.style.display = 'none';
        if (navStudent) navStudent.style.display = 'inline-block';
    } else {
        if (navAdmin) navAdmin.style.display = 'none';
        if (navFaculty) navFaculty.style.display = 'inline-block';
        if (navStudent) navStudent.style.display = 'inline-block';
    }
}
