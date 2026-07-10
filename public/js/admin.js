document.addEventListener('DOMContentLoaded', () => {
    // Page Protection check
    if (sessionStorage.getItem('admin_authenticated') !== 'true') {
        window.location.href = 'admin-auth.html';
        return;
    }
    
    updateNavigationVisibility();

    // DOM Elements
    const btnLogout = document.getElementById('btn-admin-logout');
    
    const pendingFacultyTable = document.getElementById('pending-faculty-table');
    const pendingStudentTable = document.getElementById('pending-student-table');
    const approvedFacultyTable = document.getElementById('approved-faculty-table');
    const approvedStudentTable = document.getElementById('approved-student-table');

    const attendanceRecordsTable = document.getElementById('attendance-records-table');

    // Fetch and populate directory
    async function loadDirectory() {
        try {
            const response = await fetch('/api/admin/pending');
            if (!response.ok) throw new Error('Failed to fetch approvals directory.');
            
            const data = await response.json();
            
            renderFacultyTable(data.pendingFaculty, pendingFacultyTable, true);
            renderStudentTable(data.pendingStudents, pendingStudentTable, true);
            renderFacultyTable(data.approvedFaculty, approvedFacultyTable, false);
            renderStudentTable(data.approvedStudents, approvedStudentTable, false);
            
            await loadAttendanceRecords();
        } catch (err) {
            console.error('Error fetching admin directory:', err);
        }
    }

    async function loadAttendanceRecords() {
        if (!attendanceRecordsTable) return;
        try {
            const response = await fetch('/api/attendance/records');
            if (!response.ok) throw new Error('Failed to fetch attendance logs.');
            const data = await response.json();
            renderAttendanceRecords(data.records || []);
        } catch (err) {
            console.error('Error fetching attendance logs:', err);
        }
    }

    function renderAttendanceRecords(records) {
        if (records.length === 0) {
            attendanceRecordsTable.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 2rem;">No attendance records marked yet.</td></tr>`;
            return;
        }

        attendanceRecordsTable.innerHTML = records.map(record => {
            const dateStr = new Date(record.timestamp).toLocaleString();
            const photoHtml = record.studentImage 
                ? `<a href="${escapeHtml(record.studentImage)}" target="_blank" class="avatar-link" style="display: inline-block; width: 44px; height: 44px; border-radius: 8px; overflow: hidden; border: 1px solid var(--border-color);"><img src="${escapeHtml(record.studentImage)}" style="width: 100%; height: 100%; object-fit: cover;"></a>`
                : `<span style="color: var(--text-muted); font-size: 0.8rem;">No Photo</span>`;
            
            return `
                <tr>
                    <td>${photoHtml}</td>
                    <td><code style="background: rgba(0,0,0,0.03); padding: 0.2rem 0.4rem; border-radius: 4px; font-weight: 600;">${escapeHtml(record.rollNumber)}</code></td>
                    <td style="font-weight: 600;">${escapeHtml(record.studentName)}</td>
                    <td><span style="font-size: 0.85rem; color: var(--text-muted);">${record.distanceFromCenter}m</span></td>
                    <td style="font-size: 0.85rem; color: var(--text-muted);">${escapeHtml(dateStr)}</td>
                    <td><span class="status-indicator-pill" style="background: rgba(16, 185, 129, 0.1); color: #10b981; padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.75rem; font-weight: 600;">Present</span></td>
                </tr>
            `;
        }).join('');
    }

    // Render Faculty Lists
    function renderFacultyTable(users, tableBody, isPending) {
        if (users.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">${isPending ? 'No pending registrations.' : 'No active instructors.'}</td></tr>`;
            return;
        }

        tableBody.innerHTML = users.map(user => {
            const badge = isPending ? '<span class="approval-badge badge-pending">Pending</span>' : '<span class="approval-badge badge-approved">Approved</span>';
            const actionButtons = isPending ? `
                <div class="btn-action-row">
                    <button class="btn-sm btn-approve" data-id="${user.username}" data-type="faculty" data-action="approve">Approve</button>
                    <button class="btn-sm btn-reject" data-id="${user.username}" data-type="faculty" data-action="reject">Reject</button>
                </div>
            ` : `
                <button class="btn-sm btn-reject" data-id="${user.username}" data-type="faculty" data-action="reject">Revoke</button>
            `;

            return `
                <tr>
                    <td><strong>${escapeHtml(user.username)}</strong></td>
                    <td>${badge}</td>
                    <td>${actionButtons}</td>
                </tr>
            `;
        }).join('');
    }

    // Render Student Lists
    function renderStudentTable(students, tableBody, isPending) {
        if (students.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">${isPending ? 'No pending registrations.' : 'No active students.'}</td></tr>`;
            return;
        }

        tableBody.innerHTML = students.map(s => {
            const actionButtons = isPending ? `
                <div class="btn-action-row">
                    <button class="btn-sm btn-approve" data-id="${s.rollNumber}" data-type="student" data-action="approve">Approve</button>
                    <button class="btn-sm btn-reject" data-id="${s.rollNumber}" data-type="student" data-action="reject">Reject</button>
                </div>
            ` : `
                <button class="btn-sm btn-reject" data-id="${s.rollNumber}" data-type="student" data-action="reject">Revoke</button>
            `;

            const photoHtml = s.passportPhotoUrl 
                ? `<a href="${escapeHtml(s.passportPhotoUrl)}" target="_blank" style="display: inline-block; width: 34px; height: 34px; border-radius: 6px; overflow: hidden; border: 1px solid var(--border-color); vertical-align: middle; margin-right: 0.5rem;"><img src="${escapeHtml(s.passportPhotoUrl)}" style="width: 100%; height: 100%; object-fit: cover;"></a>`
                : `<span style="color: var(--text-muted); font-size: 0.75rem; margin-right: 0.5rem;">No Photo</span>`;

            return `
                <tr>
                    <td><strong>${escapeHtml(s.rollNumber)}</strong></td>
                    <td>${photoHtml} <span style="vertical-align: middle;">${escapeHtml(s.name)}</span></td>
                    <td>${actionButtons}</td>
                </tr>
            `;
        }).join('');
    }

    // Handle Approvals and Rejections click
    document.body.addEventListener('click', async (e) => {
        if (e.target.classList.contains('btn-approve') || e.target.classList.contains('btn-reject')) {
            const id = e.target.getAttribute('data-id');
            const type = e.target.getAttribute('data-type');
            const action = e.target.getAttribute('data-action');

            if (action === 'reject' && !confirm(`Are you sure you want to ${action === 'reject' ? 'reject/revoke' : 'approve'} ${type} "${id}"?`)) {
                return;
            }

            try {
                const response = await fetch('/api/admin/approve', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type, id, action })
                });

                if (response.ok) {
                    loadDirectory();
                } else {
                    const data = await response.json();
                    alert(data.error || 'Failed to update approval status.');
                }
            } catch (err) {
                console.error('Error approving/rejecting user:', err);
            }
        }
    });

    // Logout
    btnLogout.addEventListener('click', async () => {
        sessionStorage.removeItem('admin_authenticated');
        try {
            await fetch('/api/admin/logout', { method: 'POST' });
        } catch (err) {
            console.error('Failed to logout on backend:', err);
        }
        window.location.href = 'index.html';
    });

    // Reset Database registrations
    const btnReset = document.getElementById('btn-admin-reset');
    if (btnReset) {
        btnReset.addEventListener('click', async () => {
            if (!confirm('⚠ WARNING: This will permanently delete ALL registered faculty and student accounts. Already logged-in users will be locked out. Are you sure you want to proceed?')) {
                return;
            }
            try {
                const response = await fetch('/api/admin/clear-all', { method: 'POST' });
                const data = await response.json();
                if (response.ok) {
                    alert(data.message || 'Database reset successfully.');
                    loadDirectory();
                } else {
                    alert(data.error || 'Failed to clear database.');
                }
            } catch (err) {
                console.error('Reset database error:', err);
                alert('Server network error. Failed to clear database.');
            }
        });
    }

    // Helper escape function
    function escapeHtml(str) {
        return str.replace(/&/g, '&amp;')
                  .replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;')
                  .replace(/"/g, '&quot;')
                  .replace(/'/g, '&#039;');
    }

    // Initial load
    loadDirectory();
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
