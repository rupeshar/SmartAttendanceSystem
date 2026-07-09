let studentLatitude = null;
let studentLongitude = null;
let html5QrcodeScanner = null;
let activeQrToken = null; // Stored verification token from scanned QR code
let selfieStream = null; // Camera stream for face selfie
let capturedSelfieBase64 = null; // Stored snapshot photo base64

// Map variables
let studentMap = null;
let classroomCircle = null;
let selfMarker = null;
let classCenterMarker = null;

// UI Elements
const alertBox = document.getElementById('alert-box');

const infoPanel = document.getElementById('student-info-panel');
const studentName = document.getElementById('student-name');
const studentRoll = document.getElementById('student-roll');
const btnRegisterStudent = document.getElementById('btn-register-student');
const btnVerifyStatus = document.getElementById('btn-verify-status');

const locationPanel = document.getElementById('location-panel');
const gpsIndicator = document.getElementById('gps-indicator');
const gpsStatusText = document.getElementById('gps-status-text');
const btnGetStudentGps = document.getElementById('btn-get-student-gps');
const coordsDisplay = document.getElementById('student-coords-display');
const studentLat = document.getElementById('student-lat');
const studentLng = document.getElementById('student-lng');

// Face Verification UI
const facePanel = document.getElementById('face-panel');
const selfieVideo = document.getElementById('selfie-video');
const selfiePreviewImg = document.getElementById('selfie-preview-img');
const selfieCanvas = document.getElementById('selfie-canvas');
const faceIndicator = document.getElementById('face-indicator');
const faceStatusText = document.getElementById('face-status-text');
const btnToggleSelfie = document.getElementById('btn-toggle-selfie');
const btnCaptureSelfie = document.getElementById('btn-capture-selfie');

const scanPanel = document.getElementById('scan-panel');
const btnToggleCamera = document.getElementById('btn-toggle-camera');
const sessionIdInput = document.getElementById('session-id-input');
const btnSubmitAttendance = document.getElementById('btn-submit-attendance');

// Page Initializer
window.addEventListener('DOMContentLoaded', () => {
    loadProfile();
    parseQueryToken();
    initCameraFeatureCheck();

    // Event Wireup
    if (btnRegisterStudent) btnRegisterStudent.addEventListener('click', registerStudent);
    if (btnVerifyStatus) btnVerifyStatus.addEventListener('click', verifyStatus);
    btnGetStudentGps.addEventListener('click', authorizeGPS);
    btnToggleSelfie.addEventListener('click', toggleSelfieCamera);
    btnCaptureSelfie.addEventListener('click', takeSelfieSnapshot);
    btnToggleCamera.addEventListener('click', toggleCameraScanner);
    btnSubmitAttendance.addEventListener('click', submitAttendance);
});

// Check if browser context supports native webcam access
function initCameraFeatureCheck() {
    const isCameraSupported = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    
    if (!isCameraSupported) {
        btnToggleSelfie.style.display = 'none';
        faceStatusText.textContent = 'Camera Blocked';
        showAlert('Browser secure context (HTTPS/localhost) required for webcam access. Please check browser privacy/permission settings.', 'warning');
    }
}

// Load saved student details from localStorage and verify status
async function loadProfile() {
    const savedName = localStorage.getItem('attendance_student_name');
    const savedRoll = localStorage.getItem('attendance_student_roll');
    
    if (savedRoll) {
        studentRoll.value = savedRoll;
        if (savedName) studentName.value = savedName;
        
        await checkStatus(savedRoll);
    } else {
        hideSubsequentPanels();
    }
}

// Hide panels if unapproved
function hideSubsequentPanels() {
    locationPanel.style.display = 'none';
    facePanel.style.display = 'none';
    scanPanel.style.display = 'none';
}

// Show panels if approved
function showSubsequentPanels() {
    locationPanel.style.display = 'block';
    facePanel.style.display = 'block';
    scanPanel.style.display = 'block';
}

// Check student registration status
async function checkStatus(rollNumber) {
    const statusMsg = document.getElementById('registration-status-msg');
    statusMsg.style.display = 'block';
    statusMsg.textContent = 'Verifying registration status...';
    statusMsg.style.background = 'rgba(0, 0, 0, 0.05)';
    statusMsg.style.color = 'var(--text-muted)';
    
    try {
        const response = await fetch(`/api/student/status?rollNumber=${encodeURIComponent(rollNumber)}`);
        const data = await response.json();
        
        if (data.registered) {
            if (data.approved) {
                statusMsg.textContent = `✅ Account Verified & Approved! Proceeding to check-in.`;
                statusMsg.style.background = 'rgba(16, 185, 129, 0.1)';
                statusMsg.style.color = '#10b981';
                statusMsg.style.border = '1px solid rgba(16, 185, 129, 0.2)';
                
                if (data.name) {
                    studentName.value = data.name;
                    localStorage.setItem('attendance_student_name', data.name);
                }
                localStorage.setItem('attendance_student_roll', rollNumber);
                
                showSubsequentPanels();
                authorizeGPS();
            } else {
                statusMsg.textContent = `⏳ Registration pending Admin approval. Please check back shortly.`;
                statusMsg.style.background = 'rgba(245, 158, 11, 0.1)';
                statusMsg.style.color = '#d97706';
                statusMsg.style.border = '1px solid rgba(245, 158, 11, 0.2)';
                hideSubsequentPanels();
            }
        } else {
            statusMsg.textContent = `❌ Roll number is not registered yet. Please enter your name and click Register.`;
            statusMsg.style.background = 'rgba(239, 68, 68, 0.1)';
            statusMsg.style.color = '#ef4444';
            statusMsg.style.border = '1px solid rgba(239, 68, 68, 0.2)';
            hideSubsequentPanels();
        }
    } catch (err) {
        console.error('Check status error:', err);
        statusMsg.textContent = '⚠ Network error verifying status. Please try again.';
        hideSubsequentPanels();
    }
}

// Register student account
async function registerStudent() {
    const roll = studentRoll.value.trim();
    const name = studentName.value.trim();
    
    if (!roll || !name) {
        showAlert('Please enter both Roll Number and Full Name to register.', 'error');
        return;
    }
    
    const statusMsg = document.getElementById('registration-status-msg');
    statusMsg.style.display = 'block';
    statusMsg.textContent = 'Submitting registration...';
    statusMsg.style.background = 'rgba(0,0,0,0.05)';
    statusMsg.style.color = 'var(--text-muted)';
    
    try {
        const response = await fetch('/api/student/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rollNumber: roll, name })
        });
        
        const data = await response.json();
        if (response.ok) {
            localStorage.setItem('attendance_student_roll', roll);
            localStorage.setItem('attendance_student_name', name);
            showAlert('Registration request submitted!', 'success');
            await checkStatus(roll);
        } else {
            showAlert(data.error || 'Registration failed.', 'error');
            statusMsg.textContent = `❌ ${data.error || 'Registration failed.'}`;
            statusMsg.style.background = 'rgba(239, 68, 68, 0.1)';
            statusMsg.style.color = '#ef4444';
            statusMsg.style.border = '1px solid rgba(239, 68, 68, 0.2)';
        }
    } catch (err) {
        console.error('Register error:', err);
        showAlert('Network error submitting registration.', 'error');
    }
}

// Verify student status button click
async function verifyStatus() {
    const roll = studentRoll.value.trim();
    if (!roll) {
        showAlert('Please enter your Roll Number to check registration status.', 'error');
        return;
    }
    await checkStatus(roll);
}

// Parse URL for ?sessionId= and ?token=
function parseQueryToken() {
    const urlParams = new URLSearchParams(window.location.search);
    const sId = urlParams.get('sessionId');
    const token = urlParams.get('token');
    
    if (sId) {
        sessionIdInput.value = sId;
    }
    if (token && token.length === 16) {
        activeQrToken = token;
        showAlert('Active QR code signature detected. Ready to mark attendance!', 'info');
    }
}

// Authorize and retrieve real GPS location
function authorizeGPS() {
    btnGetStudentGps.textContent = '🛰️ Connecting to GPS satellites...';
    btnGetStudentGps.disabled = true;

    if (!navigator.geolocation) {
        showAlert('Geolocation is not supported by this browser.', 'error');
        btnGetStudentGps.textContent = '📍 Authorize & Get GPS Location';
        btnGetStudentGps.disabled = false;
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            studentLatitude = position.coords.latitude;
            studentLongitude = position.coords.longitude;
            updateLocationUI(studentLatitude, studentLongitude);
            
            gpsIndicator.className = 'status-indicator status-active';
            gpsStatusText.textContent = 'GPS Connected';
            btnGetStudentGps.textContent = '📍 Get Updated Location';
            btnGetStudentGps.disabled = false;
            showAlert('GPS Location successfully acquired!', 'success');
            
            // Automatically launch Selfie Camera if supported
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                startSelfieCamera();
            }
        },
        (error) => {
            let errorMsg = 'Could not get location. ';
            if (error.code === error.PERMISSION_DENIED) {
                errorMsg += 'Please enable GPS permission in browser settings.';
            } else {
                errorMsg += error.message;
            }
            showAlert(errorMsg, 'error');
            btnGetStudentGps.textContent = '📍 Authorize & Get GPS Location';
            btnGetStudentGps.disabled = false;
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
}

// Update location data details on UI
function updateLocationUI(lat, lng) {
    coordsDisplay.style.display = 'block';
    studentLat.textContent = lat.toFixed(6);
    studentLng.textContent = lng.toFixed(6);
    
    // Update Leaflet map
    updateStudentMap(lat, lng);
}

// Map Functions for Student Portal
async function updateStudentMap(studentLatVal, studentLngVal) {
    const studentMapDiv = document.getElementById('student-map');
    studentMapDiv.style.display = 'block';

    let classLat = null;
    let classLng = null;
    let classRadius = null;

    // Check if there is an active session
    try {
        const response = await fetch('/api/session/active');
        const data = await response.json();
        if (data.session && data.session.active) {
            classLat = data.session.latitude;
            classLng = data.session.longitude;
            classRadius = data.session.radius;
        }
    } catch (e) {
        console.error('Error fetching active session for map:', e);
    }

    try {
        if (!studentMap) {
            studentMap = L.map('student-map').setView([studentLatVal, studentLngVal], 16);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '© OpenStreetMap'
            }).addTo(studentMap);
        } else {
            studentMap.setView([studentLatVal, studentLngVal], 16);
        }

        // Clear layers
        if (classroomCircle) studentMap.removeLayer(classroomCircle);
        if (selfMarker) studentMap.removeLayer(selfMarker);
        if (classCenterMarker) studentMap.removeLayer(classCenterMarker);

        // Draw class circle boundaries
        if (classLat !== null && classLng !== null) {
            classroomCircle = L.circle([classLat, classLng], {
                color: '#9333ea',
                fillColor: '#9333ea',
                fillOpacity: 0.1,
                radius: classRadius
            }).addTo(studentMap);

            classCenterMarker = L.marker([classLat, classLng]).addTo(studentMap)
                .bindPopup('Classroom Location');
        }

        // Draw self blue marker
        selfMarker = L.marker([studentLatVal, studentLngVal], {
            icon: L.divIcon({
                className: 'self-pin',
                html: `<div style="background-color: #06b6d4; border: 2px solid white; width: 14px; height: 14px; border-radius: 50%; box-shadow: 0 0 10px rgba(6, 182, 212, 0.8);"></div>`,
                iconSize: [14, 14]
            })
        }).addTo(studentMap)
          .bindPopup('Your Position')
          .openPopup();

        // Fit map bounds to view both points
        if (classLat !== null && classLng !== null) {
            const bounds = L.latLngBounds([
                [studentLatVal, studentLngVal],
                [classLat, classLng]
            ]);
            studentMap.fitBounds(bounds, { padding: [30, 30] });
        }

        setTimeout(() => {
            studentMap.invalidateSize();
        }, 200);

    } catch (err) {
        console.error('Failed to update student map:', err);
    }
}



// Helper to wrap getUserMedia with a promise timeout
function getUserMediaWithTimeout(constraints, timeoutMs = 3000) {
    return Promise.race([
        navigator.mediaDevices.getUserMedia(constraints),
        new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Webcam connection timeout')), timeoutMs)
        )
    ]);
}

// Face Verification Selfie Camera Control
async function startSelfieCamera() {
    if (selfieStream) return; // already running

    // Stop QR scanner if active to prevent camera lock conflicts
    if (html5QrcodeScanner) {
        try {
            await html5QrcodeScanner.stop();
        } catch (e) {
            console.warn('Error stopping QR scanner:', e);
        }
        html5QrcodeScanner = null;
        document.getElementById('scanner-placeholder').style.display = 'flex';
        btnToggleCamera.textContent = '🎥 Start Camera Scanner';
        btnToggleCamera.className = 'btn btn-outline';
    }

    faceStatusText.textContent = 'Connecting...';
    
    // Reset video preview displays
    selfiePreviewImg.style.display = 'none';
    selfieVideo.style.display = 'block';
    btnCaptureSelfie.style.display = 'none';

    try {
        try {
            selfieStream = await getUserMediaWithTimeout({
                video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
            }, 3000); // 3-second timeout limit
        } catch (camErr) {
            console.warn('Webcam user constraints failed, falling back to default camera:', camErr);
            selfieStream = await getUserMediaWithTimeout({
                video: true
            }, 3000);
        }
        
        selfieVideo.srcObject = selfieStream;
        faceIndicator.className = 'status-indicator status-active';
        faceStatusText.textContent = 'Webcam Active';
        btnCaptureSelfie.style.display = 'block'; // show capture button
        btnToggleSelfie.textContent = '🛑 Stop Camera';
    } catch (err) {
        console.warn('Webcam access failed:', err);
        faceIndicator.className = 'status-indicator status-inactive';
        faceStatusText.textContent = 'Webcam Failed';
        btnCaptureSelfie.style.display = 'none';
        btnToggleSelfie.textContent = '🎥 Start Selfie Camera';
        
        showAlert('Webcam connection timed out or blocked. Please enable camera permissions in your browser address bar and refresh.', 'warning');
    }
}

function stopSelfieCamera() {
    if (selfieStream) {
        selfieStream.getTracks().forEach(track => track.stop());
        selfieStream = null;
    }
    selfieVideo.srcObject = null;
    faceIndicator.className = 'status-indicator status-inactive';
    faceStatusText.textContent = 'Webcam Off';
    btnCaptureSelfie.style.display = 'none';
    btnToggleSelfie.textContent = capturedSelfieBase64 ? '📸 Retake Selfie' : '🎥 Start Selfie Camera';
}

function toggleSelfieCamera() {
    if (selfieStream) {
        stopSelfieCamera();
    } else {
        startSelfieCamera();
    }
}

// Capture and save snapshot photo of student
function takeSelfieSnapshot() {
    if (selfieStream) {
        selfieCanvas.width = selfieVideo.videoWidth || 640;
        selfieCanvas.height = selfieVideo.videoHeight || 480;
        const ctx = selfieCanvas.getContext('2d');

        // Mirror the image to match video display preview
        ctx.translate(selfieCanvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(selfieVideo, 0, 0, selfieCanvas.width, selfieCanvas.height);
        ctx.setTransform(1, 0, 0, 1, 0, 0); // reset transform

        capturedSelfieBase64 = selfieCanvas.toDataURL('image/jpeg', 0.7);

        // Turn off camera stream to free up hardware camera resource immediately
        stopSelfieCamera();

        // Display captured snapshot as static preview
        selfieVideo.style.display = 'none';
        selfiePreviewImg.src = capturedSelfieBase64;
        selfiePreviewImg.style.display = 'block';

        faceIndicator.className = 'status-indicator status-active';
        faceStatusText.textContent = 'Selfie Captured';
        showAlert('Selfie snapshot captured successfully! Ready to scan QR code.', 'success');
    }
}

// Generate a mock verification placard if camera is missing or fails
function generatePlacard() {
    selfieCanvas.width = 400;
    selfieCanvas.height = 300;
    const ctx = selfieCanvas.getContext('2d');
    
    // Gradient background
    const grad = ctx.createLinearGradient(0, 0, 400, 300);
    grad.addColorStop(0, '#0f0c20');
    grad.addColorStop(1, '#1e1b4b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 400, 300);
    
    // Accent ring
    ctx.strokeStyle = '#9333ea';
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, 380, 280);

    // Text
    ctx.fillStyle = '#06b6d4';
    ctx.font = 'bold 20px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('IDENTITY VERIFICATION', 200, 70);

    ctx.fillStyle = '#ffffff';
    ctx.font = '16px Plus Jakarta Sans, sans-serif';
    ctx.fillText(`Student: ${studentName.value}`, 200, 130);
    ctx.fillText(`Roll No: ${studentRoll.value}`, 200, 160);

    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 14px Plus Jakarta Sans, sans-serif';
    ctx.fillText('✓ GPS LOCATION SECURED', 200, 210);

    ctx.fillStyle = '#9ca3af';
    ctx.font = '11px monospace';
    ctx.fillText(new Date().toISOString().replace('T', ' ').slice(0, 19), 200, 250);

    return selfieCanvas.toDataURL('image/jpeg', 0.7);
}

// Submit Attendance to Backend API
async function submitAttendance() {
    const name = studentName.value.trim();
    const roll = studentRoll.value.trim();
    const sId = sessionIdInput.value.trim();

    if (!name || !roll) {
        showAlert('Please set your Student Profile details in Step 1 first.', 'error');
        infoPanel.style.display = 'block';
        return;
    }

    if (studentLatitude === null || studentLongitude === null) {
        showAlert('Please complete Step 2: Acquire GPS location coordinates.', 'error');
        return;
    }

    if (!sId) {
        showAlert('Please enter a valid Session / Class ID.', 'error');
        return;
    }

    // Fallback to mock placard if webcam failed or snapshot wasn't taken
    const selfieData = capturedSelfieBase64 || generatePlacard();

    // Dev Simulation Mode: fetch the current active token from server
    let tokenToUse = activeQrToken;
    if (!tokenToUse) {
        try {
            const devRes = await fetch('/api/session/active-token-dev');
            if (devRes.ok) {
                const devData = await devRes.json();
                tokenToUse = devData.token;
            } else {
                showAlert('No active attendance session is running to mock.', 'error');
                return;
            }
        } catch (e) {
            showAlert('Failed to connect to simulation helper endpoint.', 'error');
            return;
        }
    }

    const payload = {
        sessionId: sId,
        token: tokenToUse,
        studentName: name,
        rollNumber: roll,
        latitude: studentLatitude,
        longitude: studentLongitude,
        studentImage: selfieData
    };

    btnSubmitAttendance.disabled = true;
    btnSubmitAttendance.textContent = '⌛ Verifying Attendance...';

    try {
        const response = await fetch('/api/attendance/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        
        if (response.ok) {
            showAlert(`✅ Attendance Marked Successfully! distance: ${data.record.distanceFromCenter}m from center.`, 'success');
            if (navigator.vibrate) {
                navigator.vibrate([100, 50, 100]); // double buzz on success
            }
            
            // Reset verification photo state after success
            capturedSelfieBase64 = null;
            selfiePreviewImg.style.display = 'none';
            selfieVideo.style.display = 'block';
            btnToggleSelfie.textContent = '🎥 Start Selfie Camera';
            faceIndicator.className = 'status-indicator status-inactive';
            faceStatusText.textContent = 'Webcam Off';

            // Trigger student map update to redraw class circle if it was missing
            updateStudentMap(studentLatitude, studentLongitude);
        } else {
            showAlert(data.error || 'Failed to submit attendance.', 'error');
        }
    } catch (err) {
        console.error(err);
        showAlert('Network connection error. Server might be down.', 'error');
    } finally {
        btnSubmitAttendance.disabled = false;
        btnSubmitAttendance.textContent = '✅ Submit Attendance Record';
    }
}

// Camera Scanner toggle
function toggleCameraScanner() {
    const placeholder = document.getElementById('scanner-placeholder');
    
    if (html5QrcodeScanner) {
        // Stop scanning
        html5QrcodeScanner.clear().then(() => {
            html5QrcodeScanner = null;
            placeholder.style.display = 'flex';
            btnToggleCamera.textContent = '🎥 Start Camera Scanner';
            btnToggleCamera.className = 'btn btn-outline';
        }).catch(err => console.error(err));
    } else {
        // Stop selfie stream if running to prevent camera conflicts
        if (selfieStream) {
            stopSelfieCamera();
        }

        // Start scanning
        placeholder.style.display = 'none';
        btnToggleCamera.textContent = '🛑 Stop Camera Scanner';
        btnToggleCamera.className = 'btn btn-outline';
        btnToggleCamera.style.borderColor = 'var(--accent-red)';
        btnToggleCamera.style.color = 'var(--accent-red)';

        html5QrcodeScanner = new Html5Qrcode("reader");
        html5QrcodeScanner.start(
            { facingMode: "environment" }, // back camera
            {
                fps: 10,
                qrbox: { width: 250, height: 250 }
            },
            (decodedText) => {
                // Success: parsed QR code content
                handleDecodedQR(decodedText);
            },
            (errorMessage) => {
                // scanning error (normal, ignore to keep scanning)
            }
        ).catch(err => {
            console.error('Camera startup error:', err);
            showAlert('Failed to open camera: ' + err, 'error');
            toggleCameraScanner(); // reset
        });
    }
}

// Handle decoded QR codes from camera
function handleDecodedQR(decodedText) {
    try {
        const url = new URL(decodedText);
        const token = url.searchParams.get('token');
        const sId = url.searchParams.get('sessionId');
        if (token && token.length === 16 && sId) {
            activeQrToken = token;
            sessionIdInput.value = sId;
            showAlert('QR Code scanned successfully! Submitting attendance...', 'success');
            
            // Turn off camera
            toggleCameraScanner();
            
            // Auto submit
            submitAttendance();
        } else {
            showAlert('Scanned QR code is not valid for this system.', 'error');
        }
    } catch (e) {
        showAlert('Invalid QR format. Please scan the official classroom QR code.', 'error');
    }
}

// Display Toast Alert on UI
function showAlert(message, type) {
    alertBox.style.display = 'block';
    alertBox.className = `alert alert-${type}`;
    alertBox.textContent = message;
    
    // Auto scroll to top to see alert
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
