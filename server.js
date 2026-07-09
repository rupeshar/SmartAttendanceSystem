import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import os from 'os';
import QRCode from 'qrcode';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database File Path
const DB_FILE = path.join(__dirname, 'db.json');

// Ensure uploads folder exists
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Get local network IP for mobile accessibility
function getLocalIpAddress() {
    const interfaces = os.networkInterfaces();
    for (const devName in interfaces) {
        const iface = interfaces[devName];
        for (let i = 0; i < iface.length; i++) {
            const alias = iface[i];
            if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
                return alias.address;
            }
        }
    }
    return 'localhost';
}

const LOCAL_IP = getLocalIpAddress();

// Simple Database Class
class JSONDatabase {
    constructor(filePath) {
        this.filePath = filePath;
        this.data = {
            session: null,
            records: [],
            facultyUsers: [],
            studentUsers: []
        };
        this.load();
    }

    load() {
        try {
            if (fs.existsSync(this.filePath)) {
                this.data = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
                if (!this.data.facultyUsers) {
                    this.data.facultyUsers = [];
                }
                if (!this.data.studentUsers) {
                    this.data.studentUsers = [];
                }
            } else {
                this.save();
            }
        } catch (e) {
            console.error('Error loading DB, resetting:', e);
            this.save();
        }
    }

    save() {
        try {
            fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
        } catch (e) {
            console.error('Error saving DB:', e);
        }
    }

    startSession(sessionId, lat, lng, radius, durationMinutes) {
        this.data.session = {
            active: true,
            sessionId: sessionId,
            latitude: parseFloat(lat),
            longitude: parseFloat(lng),
            radius: parseInt(radius, 10),
            durationMinutes: parseInt(durationMinutes, 10),
            startedAt: Date.now(),
            expiresAt: Date.now() + parseInt(durationMinutes, 10) * 60000
        };
        this.save();
        return this.data.session;
    }

    endSession() {
        if (this.data.session) {
            this.data.session.active = false;
        }
        this.save();
    }

    addRecord(record) {
        // Prevent duplicate attendance for the same student in the current session
        const exists = this.data.records.some(r => r.rollNumber === record.rollNumber && r.sessionStartedAt === record.sessionStartedAt);
        if (exists) {
            throw new Error('Attendance already marked for this student in this session.');
        }
        this.data.records.unshift(record);
        this.save();
    }

    getRecords() {
        return this.data.records;
    }

    clearRecords() {
        this.data.records = [];
        this.data.session = null;
        this.save();
    }

    registerFaculty(username, password) {
        const exists = this.data.facultyUsers.some(u => u.username.toLowerCase() === username.toLowerCase());
        if (exists) {
            throw new Error('Faculty username already exists.');
        }
        // Newly registered faculty accounts are pending approval
        this.data.facultyUsers.push({ username, password, approved: false });
        this.save();
    }

    loginFaculty(username, password) {
        return this.data.facultyUsers.find(
            u => u.username.toLowerCase() === username.toLowerCase() && u.password === password
        );
    }

    registerStudent(rollNumber, name) {
        const cleanRoll = rollNumber.trim().toUpperCase();
        const exists = this.data.studentUsers.some(s => s.rollNumber === cleanRoll);
        if (exists) {
            throw new Error('Student roll number already registered.');
        }
        // Newly registered students are pending approval
        this.data.studentUsers.push({ rollNumber: cleanRoll, name: name.trim(), approved: false });
        this.save();
    }

    isStudentApproved(rollNumber) {
        const cleanRoll = rollNumber.trim().toUpperCase();
        const student = this.data.studentUsers.find(s => s.rollNumber === cleanRoll);
        return student ? student.approved === true : false;
    }

    approveUser(type, id, action) {
        const approved = (action === 'approve');
        if (type === 'faculty') {
            const user = this.data.facultyUsers.find(u => u.username.toLowerCase() === id.toLowerCase());
            if (!user) throw new Error('Faculty user not found.');
            user.approved = approved;
        } else if (type === 'student') {
            const cleanRoll = id.trim().toUpperCase();
            const student = this.data.studentUsers.find(s => s.rollNumber === cleanRoll);
            if (!student) throw new Error('Student not found.');
            student.approved = approved;
        } else {
            throw new Error('Invalid user type.');
        }
        this.save();
    }
}

const db = new JSONDatabase(DB_FILE);

// Secret salt generated at runtime to secure dynamic QR tokens
const SECRET_SALT = crypto.randomBytes(32).toString('hex');

// Token Generation based on time slice
// 30-second refreshes
function generateToken(sessionStartTime, timeOffset = 0) {
    const timeSlice = Math.floor(Date.now() / 30000) + timeOffset;
    return crypto.createHmac('sha256', SECRET_SALT)
                 .update(`${sessionStartTime}-${timeSlice}`)
                 .digest('hex')
                 .substring(0, 16);
}

// Token Verification
function verifyToken(sessionStartTime, token) {
    const current = generateToken(sessionStartTime, 0);
    const prev = generateToken(sessionStartTime, -1);
    const next = generateToken(sessionStartTime, 1); // handles slight clock drift
    return token === current || token === prev || token === next;
}

// Haversine Distance Formula
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth radius in meters
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const deltaPhi = (lat2 - lat1) * Math.PI / 180;
    const deltaLambda = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // in meters
}

// API Routes

// Faculty Registration
app.post('/api/faculty/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
    }
    const cleanUsername = username.trim();
    if (cleanUsername.length < 3 || password.length < 4) {
        return res.status(400).json({ error: 'Username must be at least 3 characters and password 4 characters.' });
    }
    try {
        db.registerFaculty(cleanUsername, password);
        res.json({ success: true, message: 'Faculty registered successfully!' });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Faculty Login
app.post('/api/faculty/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
    }
    const user = db.loginFaculty(username.trim(), password);
    if (user) {
        if (!user.approved) {
            return res.status(403).json({ error: 'Access Denied: Your account is pending admin approval.' });
        }
        res.json({ success: true, message: 'Login successful!', username: user.username });
    } else {
        res.status(400).json({ error: 'Invalid username or password.' });
    }
});

// Student Registration
app.post('/api/student/register', (req, res) => {
    const { rollNumber, name } = req.body;
    if (!rollNumber || !name) {
        return res.status(400).json({ error: 'Roll number and student name are required.' });
    }
    if (rollNumber.trim().length < 2 || name.trim().length < 2) {
        return res.status(400).json({ error: 'Please enter a valid roll number and name.' });
    }
    try {
        db.registerStudent(rollNumber, name);
        res.json({ success: true, message: 'Registration submitted! Please wait for Admin approval.' });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Admin Login
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
    }
    if (username.trim() === 'rupesh' && password === 'rupesh@12') {
        res.json({ success: true, message: 'Admin logged in successfully!' });
    } else {
        res.status(401).json({ error: 'Access Denied: Invalid Admin credentials.' });
    }
});

// Get Pending Registrations & All Users
app.get('/api/admin/pending', (req, res) => {
    const pendingFaculty = db.data.facultyUsers.filter(u => !u.approved);
    const pendingStudents = db.data.studentUsers.filter(s => !s.approved);
    const approvedFaculty = db.data.facultyUsers.filter(u => u.approved);
    const approvedStudents = db.data.studentUsers.filter(s => s.approved);
    res.json({
        pendingFaculty,
        pendingStudents,
        approvedFaculty,
        approvedStudents
    });
});

// Approve or Reject Users
app.post('/api/admin/approve', (req, res) => {
    const { type, id, action } = req.body; // action: 'approve' or 'reject'
    if (!type || !id || !action) {
        return res.status(400).json({ error: 'Missing type, id, or action parameter.' });
    }
    try {
        if (action === 'approve') {
            db.approveUser(type, id, 'approve');
            res.json({ success: true, message: `${type} user approved successfully.` });
        } else if (action === 'reject') {
            if (type === 'faculty') {
                db.data.facultyUsers = db.data.facultyUsers.filter(u => u.username.toLowerCase() !== id.toLowerCase());
            } else if (type === 'student') {
                db.data.studentUsers = db.data.studentUsers.filter(s => s.rollNumber.toLowerCase() !== id.toLowerCase());
            }
            db.save();
            res.json({ success: true, message: `${type} registration rejected and removed.` });
        } else {
            return res.status(400).json({ error: 'Invalid action.' });
        }
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Start a session
app.post('/api/session/start', (req, res) => {
    const { sessionId, latitude, longitude, radius, duration } = req.body;
    if (!sessionId || latitude === undefined || longitude === undefined || !radius || !duration) {
        return res.status(400).json({ error: 'Missing Session ID, coordinates, radius, or duration.' });
    }
    const session = db.startSession(sessionId, latitude, longitude, radius, duration);
    res.json({ message: 'Session started successfully', session, localIp: LOCAL_IP, port: PORT });
});

// Stop a session
app.post('/api/session/stop', (req, res) => {
    db.endSession();
    res.json({ message: 'Session ended successfully' });
});

// Get active session
app.get('/api/session/active', (req, res) => {
    if (db.data.session && db.data.session.active) {
        if (Date.now() > db.data.session.expiresAt) {
            db.endSession();
        }
    }
    res.json({ session: db.data.session, localIp: LOCAL_IP, port: PORT });
});

// Get dynamic QR code and refresh stats
app.get('/api/session/qr', async (req, res) => {
    const session = db.data.session;
    if (!session || !session.active) {
        return res.status(400).json({ error: 'No active session' });
    }

    if (Date.now() > session.expiresAt) {
        db.endSession();
        return res.status(400).json({ error: 'Session has expired' });
    }

    const token = generateToken(session.startedAt, 0);
    const timeRemaining = Math.max(0, Math.ceil((session.expiresAt - Date.now()) / 1000));
    const nextRefresh = 30 - (Math.floor(Date.now() / 1000) % 30);
    
    // Scannable URL containing Session ID and dynamic verification token
    const scannerUrl = `http://${LOCAL_IP}:${PORT}/student.html?sessionId=${session.sessionId}&token=${token}`;

    try {
        const qrCodeUrl = await QRCode.toDataURL(scannerUrl);
        res.json({
            token,
            qrCodeUrl,
            scannerUrl,
            timeRemaining,
            nextRefresh
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to generate QR code' });
    }
});

// Dev endpoint to mock QR scanning without a physical camera (fetches active token for session)
app.get('/api/session/active-token-dev', (req, res) => {
    const session = db.data.session;
    if (!session || !session.active) {
        return res.status(400).json({ error: 'No active session' });
    }
    const token = generateToken(session.startedAt, 0);
    res.json({ token, sessionId: session.sessionId });
});

// Submit attendance
app.post('/api/attendance/submit', (req, res) => {
    const session = db.data.session;
    if (!session || !session.active) {
        return res.status(400).json({ error: 'No active attendance session is running.' });
    }

    if (Date.now() > session.expiresAt) {
        db.endSession();
        return res.status(400).json({ error: 'The attendance session has expired.' });
    }

    const { sessionId, token, studentName, rollNumber, latitude, longitude, studentImage } = req.body;

    if (!sessionId || !token || !studentName || !rollNumber || latitude === undefined || longitude === undefined) {
        return res.status(400).json({ error: 'Missing Session ID, token, student details, or geolocation.' });
    }

    // Verify if student is registered and approved
    if (!db.isStudentApproved(rollNumber)) {
        return res.status(403).json({ error: 'Access Denied: Your student roll number is not registered or is pending admin approval.' });
    }

    // 0. Verify Session ID matches active session
    if (sessionId !== session.sessionId) {
        return res.status(400).json({ error: 'Invalid Session ID. This scan is not for the active classroom session.' });
    }

    // 1. Verify dynamic QR token
    const isTokenValid = verifyToken(session.startedAt, token);
    if (!isTokenValid) {
        return res.status(400).json({ error: 'QR Code is expired or invalid. Please scan the refreshed QR code.' });
    }

    // 2. Verify geofencing constraint
    const distance = calculateDistance(
        parseFloat(latitude),
        parseFloat(longitude),
        session.latitude,
        session.longitude
    );

    const isInsideGeofence = distance <= session.radius;

    if (!isInsideGeofence) {
        return res.status(400).json({
            error: `Geolocation verification failed. You are outside the classroom boundary. (Distance: ${Math.round(distance)}m, Allowed Radius: ${session.radius}m)`
        });
    }

    // 3. Save student verification photo if provided
    let photoPath = '';
    if (studentImage && studentImage.startsWith('data:image/')) {
        try {
            const matches = studentImage.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
            if (matches && matches.length === 3) {
                const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
                const buffer = Buffer.from(matches[2], 'base64');
                const fileName = `${rollNumber.replace(/[^a-zA-Z0-9]/g, '_')}-${Date.now()}.${ext}`;
                const filePath = path.join(UPLOADS_DIR, fileName);
                fs.writeFileSync(filePath, buffer);
                photoPath = `/uploads/${fileName}`;
            }
        } catch (err) {
            console.error('Failed to save student verification photo:', err);
        }
    }

    // 4. Mark attendance
    const record = {
        sessionId: session.sessionId,
        studentName,
        rollNumber,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        distanceFromCenter: Math.round(distance * 10) / 10,
        timestamp: new Date().toISOString(),
        sessionStartedAt: session.startedAt,
        photoPath: photoPath
    };

    try {
        db.addRecord(record);
        res.json({ message: 'Attendance marked successfully!', record });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Get attendance records
app.get('/api/attendance/records', (req, res) => {
    res.json({ records: db.getRecords() });
});

// Clear DB
app.post('/api/attendance/clear', (req, res) => {
    db.clearRecords();
    res.json({ message: 'All attendance records cleared' });
});

app.listen(PORT, () => {
    console.log(`===================================================`);
    console.log(`Smart Attendance Server running on port ${PORT}`);
    console.log(`Local Access:   http://localhost:${PORT}`);
    console.log(`Network Access: http://${LOCAL_IP}:${PORT}`);
    console.log(`===================================================`);
});
