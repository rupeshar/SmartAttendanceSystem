document.addEventListener('DOMContentLoaded', () => {
    const formRegister = document.getElementById('form-student-register');
    const alertBox = document.getElementById('register-alert');
    const rollInput = document.getElementById('student-roll');
    const nameInput = document.getElementById('student-name');

    formRegister.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideAlert();

        const rollNumber = rollInput.value.trim();
        const name = nameInput.value.trim();

        try {
            const response = await fetch('/api/student/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rollNumber, name })
            });

            const data = await response.json();

            if (response.ok) {
                showAlert('Registration submitted successfully! Please wait for Admin approval before checking in.', 'success');
                formRegister.reset();
            } else {
                showAlert(data.error || 'Registration failed.', 'error');
            }
        } catch (err) {
            console.error('Student Registration error:', err);
            showAlert('Server network error. Please try again.', 'error');
        }
    });

    function showAlert(message, type) {
        alertBox.textContent = message;
        alertBox.style.display = 'block';
        alertBox.className = `alert-box alert-box-${type}`;
    }

    function hideAlert() {
        alertBox.style.display = 'none';
        alertBox.textContent = '';
    }
});
