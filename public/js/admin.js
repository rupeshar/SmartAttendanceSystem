document.addEventListener('DOMContentLoaded', () => {
    // Page Protection check
    if (sessionStorage.getItem('admin_authenticated') !== 'true') {
        window.location.href = 'admin-auth.html';
        return;
    }

    // DOM Elements
    const btnLogout = document.getElementById('btn-admin-logout');
    
    const pendingFacultyTable = document.getElementById('pending-faculty-table');
    const pendingStudentTable = document.getElementById('pending-student-table');
    const approvedFacultyTable = document.getElementById('approved-faculty-table');
    const approvedStudentTable = document.getElementById('approved-student-table');

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
        } catch (err) {
            console.error('Error fetching admin directory:', err);
        }
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

            return `
                <tr>
                    <td><strong>${escapeHtml(s.rollNumber)}</strong></td>
                    <td>${escapeHtml(s.name)}</td>
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
    btnLogout.addEventListener('click', () => {
        sessionStorage.removeItem('admin_authenticated');
        window.location.href = 'index.html';
    });

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
