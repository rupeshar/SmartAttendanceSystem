import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const BASE_URL = `http://127.0.0.1:${PORT}`; // Using explicit 127.0.0.1 to avoid IPv6 loopback resolution delays

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runTests() {
    console.log('🧪 Starting integration tests for Smart Attendance System...');
    
    // Start the server process
    const serverProcess = spawn('node', ['server.js'], {
        cwd: __dirname,
        stdio: 'pipe' // Capture stdout/stderr to help diagnose issues
    });

    serverProcess.stdout.on('data', (data) => {
        const text = data.toString();
        // Log server output prefixed so we can see it
        console.log(`[Server] ${text.trim()}`);
    });

    serverProcess.stderr.on('data', (data) => {
        console.error(`[Server Error] ${data.toString()}`);
    });

    // Give server 3 seconds to fully initialize and bind to the port
    await sleep(3000);

    try {
        // Clear old database logs
        console.log('\n🧹 Clearing records...');
        const clearRes = await fetch(`${BASE_URL}/api/attendance/clear`, { method: 'POST' });
        if (!clearRes.ok) throw new Error('Failed to connect to clear endpoint');

        // Start a new session
        console.log('🚀 Starting a new session at Bangalore center (12.9716, 77.5946) with 50m radius...');
        const startRes = await fetch(`${BASE_URL}/api/session/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId: 'CS01',
                latitude: 12.9716,
                longitude: 77.5946,
                radius: 50,
                duration: 10
            })
        });
        const startData = await startRes.json();
        if (!startRes.ok) throw new Error(`Failed to start session: ${startData.error}`);
        console.log('✅ Session started.');

        // Fetch the active QR token
        console.log('\n🔑 Fetching active dynamic QR token...');
        const qrRes = await fetch(`${BASE_URL}/api/session/qr`);
        const qrData = await qrRes.json();
        if (!qrRes.ok) throw new Error(`Failed to get QR code: ${qrData.error}`);
        const token = qrData.token;
        console.log(`✅ Retrieved active token: ${token}`);

        // Test Case 1: Valid coordinate & Valid token (Should Succeed)
        console.log('\n👉 TEST 1: Submitting attendance inside the classroom (dist ~ 0m)...');
        const submitRes1 = await fetch(`${BASE_URL}/api/attendance/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId: 'CS01',
                token: token,
                studentName: 'Alice Green',
                rollNumber: 'CS01',
                latitude: 12.9716,
                longitude: 77.5946
            })
        });
        const submitData1 = await submitRes1.json();
        if (submitRes1.ok) {
            console.log(`✅ Success! Marked: ${submitData1.record.studentName} at distance ${submitData1.record.distanceFromCenter}m`);
        } else {
            throw new Error(`TEST 1 Failed: ${submitData1.error}`);
        }

        // Test Case 2: Out of Geofence Bounds coordinate & Valid token (Should Fail)
        console.log('\n👉 TEST 2: Submitting attendance from home (dist ~ 711m)...');
        const submitRes2 = await fetch(`${BASE_URL}/api/attendance/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId: 'CS01',
                token: token,
                studentName: 'Bob Red',
                rollNumber: 'CS02',
                latitude: 12.9780, // shifted latitude
                longitude: 77.5946
            })
        });
        const submitData2 = await submitRes2.json();
        if (!submitRes2.ok && submitRes2.status === 400) {
            console.log(`✅ Success (Failed as expected)! Error: ${submitData2.error}`);
        } else {
            throw new Error(`TEST 2 Failed: Expected validation error but got success.`);
        }

        // Test Case 3: Inside Geofence Bounds but Invalid Token (Should Fail)
        console.log('\n👉 TEST 3: Submitting attendance inside classroom with invalid token...');
        const submitRes3 = await fetch(`${BASE_URL}/api/attendance/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId: 'CS01',
                token: 'invalidtoken1234',
                studentName: 'Charlie Blue',
                rollNumber: 'CS03',
                latitude: 12.9716,
                longitude: 77.5946
            })
        });
        const submitData3 = await submitRes3.json();
        if (!submitRes3.ok && submitRes3.status === 400) {
            console.log(`✅ Success (Failed as expected)! Error: ${submitData3.error}`);
        } else {
            throw new Error(`TEST 3 Failed: Expected token validation error but got success.`);
        }

        console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! The system security checks work perfectly.');
        
        // Stop session and cleanup
        await fetch(`${BASE_URL}/api/session/stop`, { method: 'POST' });
        serverProcess.kill();
        process.exit(0);

    } catch (err) {
        console.error(`\n❌ TEST FAILED: ${err.message}`);
        serverProcess.kill();
        process.exit(1);
    }
}

runTests();
