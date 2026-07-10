let sessionActive = false;
let qrInterval = null;
let logInterval = null;
let countdownInterval = null;

// Map variables
let map = null;
let centerMarker = null;
let geofenceCircle = null;
let studentMarkers = [];

// UI Elements
const setupPanel = document.getElementById('session-setup-panel');
const setupForm = document.getElementById('setup-form');
const activeSessionInfo = document.getElementById('active-session-info');
const sessionIndicator = document.getElementById('session-indicator');
const sessionStatusText = document.getElementById('session-status-text');

const sessionId = document.getElementById('session-id');
const classLat = document.getElementById('class-lat');
const classLng = document.getElementById('class-lng');
const classRadius = document.getElementById('class-radius');
const sessionDuration = document.getElementById('session-duration');

const btnGetGps = document.getElementById('btn-get-gps');
const btnStartSession = document.getElementById('btn-start-session');
const btnStopSession = document.getElementById('btn-stop-session');

const infoCoords = document.getElementById('info-coords');
const infoRadius = document.getElementById('info-radius');
const infoExpiryTimer = document.getElementById('info-expiry-timer');
const infoSessionId = document.getElementById('info-session-id');

const qrPanel = document.getElementById('qr-panel');
const qrCodeImg = document.getElementById('qr-code-img');
const qrProgress = document.getElementById('qr-progress');
const qrTimerLbl = document.getElementById('qr-timer-lbl');
const studentPortalFriendlyLink = document.getElementById('student-portal-friendly-link');

const attendanceTbody = document.getElementById('attendance-tbody');
const attendeeCount = document.getElementById('attendee-count');
const btnExportCsv = document.getElementById('btn-export-csv');
const btnClearRecords = document.getElementById('btn-clear-records');

// Live check-in spotlight tracking
let lastRecordTimestamp = null;
const spotlightCard = document.getElementById('spotlight-card');
const spotlightImg = document.getElementById('spotlight-img');
const spotlightName = document.getElementById('spotlight-name');
const spotlightRoll = document.getElementById('spotlight-roll');
const spotlightDist = document.getElementById('spotlight-dist');

const DEFAULT_AVATAR = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="%231e1b4b"/><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" fill="%2306b6d4"/></svg>`;

// Initial Setup on Page Load
window.addEventListener('DOMContentLoaded', () => {
    // Security check: Enforce registration/login to prevent unauthorized student access
    if (sessionStorage.getItem('faculty_authenticated') !== 'true') {
        window.location.href = 'faculty-auth.html';
        return;
    }

    checkActiveSession();
    startPollingLogs();
    
    // Wire up events
    btnGetGps.addEventListener('click', getCurrentLocation);
    btnStartSession.addEventListener('click', startSession);
    btnStopSession.addEventListener('click', stopSession);
    btnExportCsv.addEventListener('click', exportAttendanceCSV);
    btnClearRecords.addEventListener('click', clearRecords);
});

// Preset coords helper for testing (called from HTML onclick)
window.setPresetCoords = function(lat, lng) {
    classLat.value = lat;
    classLng.value = lng;
};

// Check if a session is already running on the server
async function checkActiveSession() {
    try {
        const response = await fetch('/api/session/active');
        const data = await response.json();
        
        if (data.session && data.session.active) {
            handleSessionStarted(data.session);
        } else {
            handleSessionStopped();
        }
    } catch (err) {
        console.error('Error checking active session:', err);
    }
}

// Get GPS coordinates of the current device
function getCurrentLocation() {
    btnGetGps.textContent = '🛰️ Retrieving Geolocation...';
    btnGetGps.disabled = true;

    if (!navigator.geolocation) {
        alert('Geolocation is not supported by your browser.');
        btnGetGps.textContent = '📍 Use Current Device Location';
        btnGetGps.disabled = false;
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            classLat.value = position.coords.latitude.toFixed(6);
            classLng.value = position.coords.longitude.toFixed(6);
            btnGetGps.textContent = '📍 Use Current Device Location';
            btnGetGps.disabled = false;
        },
        (error) => {
            alert(`Error getting location: ${error.message}`);
            btnGetGps.textContent = '📍 Use Current Device Location';
            btnGetGps.disabled = false;
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
}

// Start a session
async function startSession() {
    const sId = sessionId.value.trim();
    const lat = parseFloat(classLat.value);
    const lng = parseFloat(classLng.value);
    const radius = parseInt(classRadius.value, 10);
    const duration = parseInt(sessionDuration.value, 10);

    if (!sId) {
        alert('Please enter a Session / Class ID.');
        return;
    }
    if (isNaN(lat) || isNaN(lng)) {
        alert('Please enter valid latitude and longitude coordinates.');
        return;
    }
    if (isNaN(radius) || radius <= 0) {
        alert('Please enter a valid radius in meters.');
        return;
    }
    if (isNaN(duration) || duration <= 0) {
        alert('Please enter a valid duration in minutes.');
        return;
    }

    try {
        const response = await fetch('/api/session/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: sId, latitude: lat, longitude: lng, radius, duration })
        });
        
        const data = await response.json();
        if (response.ok) {
            handleSessionStarted(data.session);
        } else {
            alert(data.error || 'Failed to start session.');
        }
    } catch (err) {
        console.error('Error starting session:', err);
        alert('Failed to connect to the server.');
    }
}

// Stop the session
async function stopSession() {
    if (!confirm('Are you sure you want to stop the attendance session? Students will no longer be able to submit.')) {
        return;
    }
    try {
        const response = await fetch('/api/session/stop', { method: 'POST' });
        if (response.ok) {
            handleSessionStopped();
        }
    } catch (err) {
        console.error('Error stopping session:', err);
    }
}

// Map Functions for Faculty Dashboard
function initFacultyMap(lat, lng, radius) {
    try {
        if (!map) {
            map = L.map('faculty-map').setView([lat, lng], 16);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '© OpenStreetMap'
            }).addTo(map);
        } else {
            map.setView([lat, lng], 16);
        }

        // Clean previous center elements
        if (centerMarker) map.removeLayer(centerMarker);
        if (geofenceCircle) map.removeLayer(geofenceCircle);

        // Class Center pin
        centerMarker = L.marker([lat, lng]).addTo(map)
            .bindPopup('Classroom Center Location')
            .openPopup();

        // Geofence circle
        geofenceCircle = L.circle([lat, lng], {
            color: '#9333ea',
            fillColor: '#9333ea',
            fillOpacity: 0.15,
            radius: radius
        }).addTo(map);

        // Correct dimensions rendering
        setTimeout(() => {
            map.invalidateSize();
        }, 200);

    } catch (e) {
        console.error('Failed to load map:', e);
    }
}

function updateStudentMarkersOnMap(records) {
    if (!map) return;

    // Clear older student pins
    studentMarkers.forEach(m => map.removeLayer(m));
    studentMarkers = [];

    // Add pins for current attendees
    records.forEach(r => {
        const pin = L.circleMarker([r.latitude, r.longitude], {
            radius: 8,
            fillColor: '#06b6d4',
            color: '#ffffff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
        }).addTo(map)
          .bindPopup(`<b>${escapeHtml(r.studentName)}</b> (${escapeHtml(r.rollNumber)})<br>Distance: ${r.distanceFromCenter}m`);

        studentMarkers.push(pin);
    });
}

function destroyFacultyMap() {
    if (map) {
        map.remove();
        map = null;
        centerMarker = null;
        geofenceCircle = null;
        studentMarkers = [];
    }
}

// UI State Updates
function handleSessionStarted(session) {
    sessionActive = true;
    
    // Status Indicator
    sessionIndicator.className = 'status-indicator status-active';
    sessionStatusText.textContent = 'Active';
    
    // Swap forms
    setupForm.style.display = 'none';
    activeSessionInfo.style.display = 'block';
    
    // Populate Info Details
    infoSessionId.textContent = session.sessionId;
    infoCoords.textContent = `${session.latitude.toFixed(5)}, ${session.longitude.toFixed(5)}`;
    infoRadius.textContent = session.radius;
    
    // Initialize Leaflet Map
    initFacultyMap(session.latitude, session.longitude, session.radius);

    // Start Expiry Countdown
    startExpiryCountdown(session.expiresAt);

    // Show QR code panel & start refresh polling
    qrPanel.style.display = 'block';
    fetchQR();
    clearInterval(qrInterval);
    qrInterval = setInterval(fetchQR, 1000);
}

function handleSessionStopped() {
    sessionActive = false;
    
    sessionIndicator.className = 'status-indicator status-inactive';
    sessionStatusText.textContent = 'Inactive';
    
    setupForm.style.display = 'block';
    activeSessionInfo.style.display = 'none';
    qrPanel.style.display = 'none';
    
    clearInterval(qrInterval);
    clearInterval(countdownInterval);
    
    // Remove Leaflet map instances
    destroyFacultyMap();

    infoExpiryTimer.textContent = '--';
    qrCodeImg.src = '';
    studentPortalFriendlyLink.href = '';
    studentPortalFriendlyLink.textContent = '--';
}

// Format expiry remaining time
function startExpiryCountdown(expiresAt) {
    clearInterval(countdownInterval);
    
    function updateTimer() {
        const msLeft = expiresAt - Date.now();
        if (msLeft <= 0) {
            handleSessionStopped();
            alert('The attendance session has expired.');
            return;
        }
        
        const minutes = Math.floor(msLeft / 60000);
        const seconds = Math.floor((msLeft % 60000) / 1000);
        infoExpiryTimer.textContent = `${minutes}m ${seconds}s`;
    }
    
    updateTimer();
    countdownInterval = setInterval(updateTimer, 1000);
}

// Fetch QR Code and dynamic details
async function fetchQR() {
    try {
        const response = await fetch('/api/session/qr');
        if (!response.ok) {
            if (response.status === 400) {
                // Session expired or stopped on server
                handleSessionStopped();
            }
            return;
        }
        
        const data = await response.json();
        
        // Show QR Image
        qrCodeImg.src = data.qrCodeUrl;
        
        // Update scannable URL link (friendly link showing Session ID but hiding security token)
        const friendlyUrl = `${window.location.protocol}//${window.location.host}/student.html?sessionId=${data.sessionId}`;
        studentPortalFriendlyLink.href = friendlyUrl;
        studentPortalFriendlyLink.textContent = friendlyUrl;
        
        // Update countdown progress bar (10s window)
        const secondsLeft = data.nextRefresh;
        qrTimerLbl.textContent = `Refreshing in ${secondsLeft}s...`;
        
        // Simple progress bar setting
        const percent = (secondsLeft / 30) * 100;
        qrProgress.style.transition = secondsLeft === 30 ? 'none' : 'width 1s linear';
        qrProgress.style.width = `${percent}%`;
        
    } catch (err) {
        console.error('Error fetching QR code:', err);
    }
}

// Poll attendance records every 2 seconds
function startPollingLogs() {
    fetchLogs();
    clearInterval(logInterval);
    logInterval = setInterval(fetchLogs, 2000);
}

async function fetchLogs() {
    try {
        const response = await fetch('/api/attendance/records');
        const data = await response.json();
        renderRecords(data.records);
    } catch (err) {
        console.error('Error fetching logs:', err);
    }
}

// Render records in dashboard table
function renderRecords(records) {
    attendeeCount.textContent = records.length;
    
    // Update map locations for students
    updateStudentMarkersOnMap(records);

    // Update Spotlight Card with latest sign-in details
    if (records.length > 0) {
        const latest = records[0];
        if (latest.timestamp !== lastRecordTimestamp) {
            lastRecordTimestamp = latest.timestamp;
            spotlightImg.src = latest.photoPath ? latest.photoPath : DEFAULT_AVATAR;
            spotlightName.textContent = latest.studentName;
            spotlightRoll.textContent = latest.rollNumber;
            spotlightDist.textContent = latest.distanceFromCenter;
            spotlightCard.style.display = 'block';
        }
    } else {
        spotlightCard.style.display = 'none';
        lastRecordTimestamp = null;
    }

    if (records.length === 0) {
        attendanceTbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 2rem;">
                    No attendance records marked yet.
                </td>
            </tr>
        `;
        return;
    }
    
    attendanceTbody.innerHTML = records.map(record => {
        const date = new Date(record.timestamp);
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        
        const photoHtml = record.photoPath 
            ? `<img src="${record.photoPath}" style="width: 38px; height: 38px; border-radius: 50%; object-fit: cover; border: 1px solid var(--border-color); vertical-align: middle; cursor: pointer;" onclick="window.open('${record.photoPath}', '_blank')" title="Click to view full photo">`
            : `<div style="width: 38px; height: 38px; border-radius: 50%; background: rgba(255,255,255,0.05); display: inline-flex; align-items: center; justify-content: center; font-size: 0.8rem; border: 1px dashed var(--border-color); vertical-align: middle;">👤</div>`;

        return `
            <tr>
                <td style="text-align: center;">${photoHtml}</td>
                <td><strong>${escapeHtml(record.rollNumber)}</strong></td>
                <td>${escapeHtml(record.studentName)}</td>
                <td>${record.distanceFromCenter}m</td>
                <td>${timeStr}</td>
                <td><span class="status-badge status-present">Present</span></td>
            </tr>
        `;
    }).join('');
}

// Clear all records
async function clearRecords() {
    if (!confirm('Are you sure you want to delete all historical attendance records? This cannot be undone.')) {
        return;
    }
    try {
        const response = await fetch('/api/attendance/clear', { method: 'POST' });
        if (response.ok) {
            fetchLogs();
        }
    } catch (err) {
        console.error('Error clearing logs:', err);
    }
}

// Export logs as CSV download
function exportAttendanceCSV() {
    fetch('/api/attendance/records')
        .then(res => res.json())
        .then(data => {
            const records = data.records;
            if (records.length === 0) {
                alert('No records available to export.');
                return;
            }
            
            let csvContent = 'Roll Number,Student Name,Latitude,Longitude,Distance (m),Timestamp,Photo Link\n';
            records.forEach(r => {
                const fullPhotoUrl = r.photoPath ? `${window.location.protocol}//${window.location.host}${r.photoPath}` : '';
                const photoCell = fullPhotoUrl ? `=HYPERLINK(""${fullPhotoUrl}"",""Click to View Photo"")` : 'No Photo';
                csvContent += `"${r.rollNumber}","${r.studentName}",${r.latitude},${r.longitude},${r.distanceFromCenter},"${r.timestamp}","${photoCell}"\n`;
            });
            
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.setAttribute('href', url);
            
            const date = new Date().toISOString().slice(0,10);
            link.setAttribute('download', `attendance_report_${date}.csv`);
            link.style.visibility = 'hidden';
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        })
        .catch(err => console.error('Error exporting records:', err));
}

// Utility function to escape HTML to prevent XSS
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
