const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const ical = require('node-ical');
const axios = require('axios');

const app = express();
const PORT = 3001;
const SECRET_KEY = 'my-secret-key-1234'; // 실무에서는 환경변수로 관리하세요.

// Middleware
app.use(cors());
app.use(express.json());

// Database Setup
const dbPath = path.resolve(__dirname, 'schedule.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database: ' + err.message);
    } else {
        console.log('Connected to SQLite database.');
        initTables();
    }
});

function initTables() {
    db.serialize(() => {
        // 1. Users Table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password TEXT
        )`);

        // 2. Events Table (Add user_id)
        db.run(`CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            title TEXT NOT NULL,
            start TEXT NOT NULL,
            end TEXT,
            allDay INTEGER DEFAULT 0,
            description TEXT,
            color TEXT DEFAULT '#3788d8',
            completed INTEGER DEFAULT 0,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )`);

        // 3. External Calendars Table
        db.run(`CREATE TABLE IF NOT EXISTS external_calendars (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            url TEXT NOT NULL,
            name TEXT,
            color TEXT DEFAULT '#888888',
            FOREIGN KEY(user_id) REFERENCES users(id)
        )`);
        
        // Add user_id column if it doesn't exist (Migration for existing db)
        db.run("ALTER TABLE events ADD COLUMN user_id INTEGER", (err) => {
            // Ignore error if column already exists
        });
    });
}

// --- Auth Middleware ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// --- Routes ---

// 1. Auth: Register
app.post('/api/auth/register', (req, res) => {
    const { username, password } = req.body;
    const hashedPassword = bcrypt.hashSync(password, 8);
    
    db.run(`INSERT INTO users (username, password) VALUES (?, ?)`, [username, hashedPassword], function(err) {
        if (err) return res.status(400).json({ error: "Username already exists." });
        res.json({ message: "User created successfully." });
    });
});

// 2. Auth: Login
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, user) => {
        if (err || !user) return res.status(400).json({ error: "User not found." });
        
        const validPassword = bcrypt.compareSync(password, user.password);
        if (!validPassword) return res.status(400).json({ error: "Invalid password." });

        const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY, { expiresIn: '24h' });
        res.json({ token, username: user.username });
    });
});

// 3. Events: Get All (User Specific + External)
app.get('/api/events', authenticateToken, async (req, res) => {
    const userId = req.user.id;

    // 1. Fetch Local Events
    const getLocalEvents = new Promise((resolve, reject) => {
        db.all('SELECT * FROM events WHERE user_id = ?', [userId], (err, rows) => {
            if (err) reject(err);
            else resolve(rows.map(r => ({ ...r, allDay: !!r.allDay, completed: !!r.completed })));
        });
    });

    // 2. Fetch External Calendars
    const getExternalEvents = new Promise((resolve, reject) => {
        db.all('SELECT * FROM external_calendars WHERE user_id = ?', [userId], async (err, rows) => {
            if (err) {
                resolve([]); 
                return;
            }
            
            const allExternalEvents = [];
            for (const calendar of rows) {
                try {
                    // Fetch ICS file content
                    const response = await axios.get(calendar.url);
                    const data = ical.parseICS(response.data);
                    
                    for (let k in data) {
                        if (data.hasOwnProperty(k)) {
                            const ev = data[k];
                            if (data[k].type === 'VEVENT') {
                                allExternalEvents.push({
                                    id: `ext-${calendar.id}-${ev.uid}`, // Unique ID
                                    title: `[Ext] ${ev.summary}`,
                                    start: ev.start,
                                    end: ev.end,
                                    description: ev.description,
                                    color: calendar.color,
                                    allDay: ev.start && !ev.start.getHours && !ev.start.getMinutes, // Simple check
                                    editable: false // External events are read-only
                                });
                            }
                        }
                    }
                } catch (e) {
                    console.error(`Failed to load calendar ${calendar.url}:`, e.message);
                }
            }
            resolve(allExternalEvents);
        });
    });

    try {
        const [local, external] = await Promise.all([getLocalEvents, getExternalEvents]);
        res.json({ message: "success", data: [...local, ...external] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Events: Create
app.post('/api/events', authenticateToken, (req, res) => {
    const { title, start, end, allDay, description, color } = req.body;
    const sql = 'INSERT INTO events (user_id, title, start, end, allDay, description, color) VALUES (?,?,?,?,?,?,?)';
    const params = [req.user.id, title, start, end, allDay ? 1 : 0, description, color];
    
    db.run(sql, params, function (err) {
        if (err) {
            res.status(400).json({ "error": err.message });
            return;
        }
        res.json({ message: "success", data: { id: this.lastID, ...req.body } });
    });
});

// 5. Events: Update
app.put('/api/events/:id', authenticateToken, (req, res) => {
    // Only update if event belongs to user
    const { title, start, end, allDay, description, color, completed } = req.body;
    const sql = `UPDATE events SET 
                 title = COALESCE(?, title), 
                 start = COALESCE(?, start), 
                 end = COALESCE(?, end), 
                 allDay = COALESCE(?, allDay), 
                 description = COALESCE(?, description), 
                 color = COALESCE(?, color),
                 completed = COALESCE(?, completed)
                 WHERE id = ? AND user_id = ?`;
    
    const params = [
        title, start, end, 
        allDay !== undefined ? (allDay ? 1 : 0) : undefined, 
        description, color, 
        completed !== undefined ? (completed ? 1 : 0) : undefined,
        req.params.id, req.user.id
    ];

    db.run(sql, params, function (err) {
        if (err) return res.status(400).json({ "error": err.message });
        res.json({ "message": "success", "changes": this.changes });
    });
});

// 6. Events: Delete
app.delete('/api/events/:id', authenticateToken, (req, res) => {
    const sql = 'DELETE FROM events WHERE id = ? AND user_id = ?';
    db.run(sql, [req.params.id, req.user.id], function (err) {
        if (err) return res.status(400).json({ "error": err.message });
        res.json({ "message": "deleted", changes: this.changes });
    });
});

// 7. External Calendars: Get All
app.get('/api/calendars', authenticateToken, (req, res) => {
    db.all('SELECT * FROM external_calendars WHERE user_id = ?', [req.user.id], (err, rows) => {
        if (err) return res.status(400).json({ error: err.message });
        res.json({ message: "success", data: rows });
    });
});

// 8. External Calendars: Add
app.post('/api/calendars', authenticateToken, (req, res) => {
    const { url, name, color } = req.body;
    db.run('INSERT INTO external_calendars (user_id, url, name, color) VALUES (?, ?, ?, ?)', 
        [req.user.id, url, name, color], function(err) {
        if (err) return res.status(400).json({ error: err.message });
        res.json({ message: "success", id: this.lastID });
    });
});

// 9. External Calendars: Delete
app.delete('/api/calendars/:id', authenticateToken, (req, res) => {
    db.run('DELETE FROM external_calendars WHERE id = ? AND user_id = ?', 
        [req.params.id, req.user.id], function(err) {
        if (err) return res.status(400).json({ error: err.message });
        res.json({ message: "deleted", changes: this.changes });
    });
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});