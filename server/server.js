const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const ical = require('node-ical');
const axios = require('axios');
const crypto = require('crypto');

const app = express();
const PORT = 3001;
const SECRET_KEY = 'my-secret-key-1234'; // 실무에서는 환경변수로 관리하세요.

function nowMs() {
    return Date.now();
}

function randomState() {
    return crypto.randomBytes(24).toString('hex');
}

function getClientUrl() {
    return process.env.CLIENT_URL || 'http://localhost:5173';
}

function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function normalizeProvider(provider) {
    const p = (provider || '').toLowerCase();
    if (p === 'google') return 'google';
    if (p === 'naverworks' || p === 'naver_works' || p === 'naver-works') return 'naverworks';
    return null;
}

function requireEnv(name) {
    const v = process.env[name];
    if (!v) throw new Error(`Missing ${name}`);
    return v;
}

function getGoogleConfig() {
    return {
        clientId: requireEnv('GOOGLE_CLIENT_ID'),
        clientSecret: requireEnv('GOOGLE_CLIENT_SECRET'),
        redirectUri: requireEnv('GOOGLE_REDIRECT_URI'),
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token'
    };
}

function getNaverWorksConfig() {
    return {
        clientId: requireEnv('NAVERWORKS_CLIENT_ID'),
        clientSecret: requireEnv('NAVERWORKS_CLIENT_SECRET'),
        redirectUri: requireEnv('NAVERWORKS_REDIRECT_URI'),
        authUrl: requireEnv('NAVERWORKS_AUTH_URL'),
        tokenUrl: requireEnv('NAVERWORKS_TOKEN_URL'),
        apiBase: requireEnv('NAVERWORKS_API_BASE')
    };
}

async function upsertConnectedAccount({ userId, provider, tokenResponse }) {
    const now = nowMs();
    const accessTokenEnc = encryptToken(tokenResponse.access_token);
    const refreshTokenEnc = encryptToken(tokenResponse.refresh_token);
    const expiresAt = tokenResponse.expires_in ? (now + Number(tokenResponse.expires_in) * 1000) : null;

    const existing = await dbGet(
        'SELECT id, refresh_token_enc FROM connected_accounts WHERE user_id = ? AND provider = ?',
        [userId, provider]
    );

    if (!existing) {
        const result = await dbRun(
            `INSERT INTO connected_accounts (user_id, provider, access_token_enc, refresh_token_enc, token_type, scope, expires_at, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                userId,
                provider,
                accessTokenEnc,
                refreshTokenEnc,
                tokenResponse.token_type || null,
                tokenResponse.scope || null,
                expiresAt,
                now,
                now
            ]
        );
        return { id: result.lastID };
    }

    // Some providers only return refresh_token on first consent
    const refreshToStore = refreshTokenEnc || existing.refresh_token_enc || null;
    await dbRun(
        `UPDATE connected_accounts
         SET access_token_enc = ?, refresh_token_enc = ?, token_type = ?, scope = ?, expires_at = ?, updated_at = ?
         WHERE id = ? AND user_id = ?`,
        [
            accessTokenEnc,
            refreshToStore,
            tokenResponse.token_type || null,
            tokenResponse.scope || null,
            expiresAt,
            now,
            existing.id,
            userId
        ]
    );
    return { id: existing.id };
}

async function refreshAccessTokenIfNeeded(account) {
    if (!account) throw new Error('Missing connected account');
    const provider = normalizeProvider(account.provider);
    const expiresAt = account.expires_at ? Number(account.expires_at) : null;

    // If no expiry is known, assume access token is usable.
    if (!expiresAt || Number.isNaN(expiresAt)) {
        return { accessToken: decryptToken(account.access_token_enc), refreshed: false };
    }

    const skewMs = 60 * 1000;
    if (expiresAt - skewMs > nowMs()) {
        return { accessToken: decryptToken(account.access_token_enc), refreshed: false };
    }

    const refreshToken = decryptToken(account.refresh_token_enc);
    if (!refreshToken) {
        return { accessToken: decryptToken(account.access_token_enc), refreshed: false };
    }

    const now = nowMs();
    if (provider === 'google') {
        const cfg = getGoogleConfig();
        const body = new URLSearchParams({
            client_id: cfg.clientId,
            client_secret: cfg.clientSecret,
            grant_type: 'refresh_token',
            refresh_token: refreshToken
        });
        const tokenRes = await axios.post(cfg.tokenUrl, body.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        const tr = tokenRes.data;
        const newAccessTokenEnc = encryptToken(tr.access_token);
        const newExpiresAt = tr.expires_in ? (now + Number(tr.expires_in) * 1000) : expiresAt;
        await dbRun(
            'UPDATE connected_accounts SET access_token_enc = ?, expires_at = ?, updated_at = ? WHERE id = ? AND user_id = ?',
            [newAccessTokenEnc, newExpiresAt, now, account.id, account.user_id]
        );
        return { accessToken: tr.access_token, refreshed: true };
    }

    if (provider === 'naverworks') {
        const cfg = getNaverWorksConfig();
        const body = new URLSearchParams({
            client_id: cfg.clientId,
            client_secret: cfg.clientSecret,
            grant_type: 'refresh_token',
            refresh_token: refreshToken
        });
        const tokenRes = await axios.post(cfg.tokenUrl, body.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        const tr = tokenRes.data;
        const newAccessTokenEnc = encryptToken(tr.access_token);
        const newExpiresAt = tr.expires_in ? (now + Number(tr.expires_in) * 1000) : expiresAt;
        await dbRun(
            'UPDATE connected_accounts SET access_token_enc = ?, expires_at = ?, updated_at = ? WHERE id = ? AND user_id = ?',
            [newAccessTokenEnc, newExpiresAt, now, account.id, account.user_id]
        );
        return { accessToken: tr.access_token, refreshed: true };
    }

    return { accessToken: decryptToken(account.access_token_enc), refreshed: false };
}

async function fetchAndUpsertProviderCalendars({ userId, provider, accountId, accessToken }) {
    const now = nowMs();
    if (provider === 'google') {
        const url = 'https://www.googleapis.com/calendar/v3/users/me/calendarList';
        const res = await axios.get(url, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        const items = Array.isArray(res.data?.items) ? res.data.items : [];
        for (const item of items) {
            const canWrite = item.accessRole === 'owner' || item.accessRole === 'writer';
            await dbRun(
                `INSERT INTO connected_calendars (user_id, account_id, provider, provider_calendar_id, name, color, can_write, is_enabled, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT(user_id, provider, provider_calendar_id)
                 DO UPDATE SET account_id = excluded.account_id, name = excluded.name, color = excluded.color, can_write = excluded.can_write, updated_at = excluded.updated_at`,
                [
                    userId,
                    accountId,
                    provider,
                    String(item.id),
                    item.summary || null,
                    item.backgroundColor || null,
                    canWrite ? 1 : 0,
                    1,
                    now
                ]
            );
        }
        return;
    }

    if (provider === 'naverworks') {
        const cfg = getNaverWorksConfig();
        const listUrl = `${cfg.apiBase.replace(/\/+$/, '')}/calendar/v1/calendars`;
        const res = await axios.get(listUrl, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        const raw = res.data;
        const list = Array.isArray(raw) ? raw : (Array.isArray(raw?.calendars) ? raw.calendars : (Array.isArray(raw?.data) ? raw.data : []));
        for (const item of list) {
            const providerCalendarId = item.calendarId || item.id || item.calendar_id;
            if (!providerCalendarId) continue;
            const name = item.name || item.summary || item.title || null;
            const color = item.color || item.backgroundColor || null;
            const canWrite = item.canWrite !== undefined ? !!item.canWrite : (item.can_write !== undefined ? !!item.can_write : true);

            await dbRun(
                `INSERT INTO connected_calendars (user_id, account_id, provider, provider_calendar_id, name, color, can_write, is_enabled, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT(user_id, provider, provider_calendar_id)
                 DO UPDATE SET account_id = excluded.account_id, name = excluded.name, color = excluded.color, can_write = excluded.can_write, updated_at = excluded.updated_at`,
                [
                    userId,
                    accountId,
                    provider,
                    String(providerCalendarId),
                    name,
                    color,
                    canWrite ? 1 : 0,
                    1,
                    now
                ]
            );
        }
        return;
    }
}

function dateOnly(value) {
    if (!value) return null;
    const s = String(value);
    return s.length >= 10 ? s.slice(0, 10) : s;
}

function asIsoDateTime(value) {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
}

function addMinutesIso(isoValue, minutes) {
    if (!isoValue) return null;
    const d = new Date(isoValue);
    if (Number.isNaN(d.getTime())) return null;
    d.setMinutes(d.getMinutes() + minutes);
    return d.toISOString();
}

async function createProviderEvent({ provider, accessToken, providerCalendarId, event }) {
    if (provider === 'google') {
        const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(providerCalendarId)}/events`;
        const allDay = !!event.allDay;
        const startIso = asIsoDateTime(event.start);
        if (!startIso) throw new Error('Invalid event start datetime');
        const endIso = asIsoDateTime(event.end) || addMinutesIso(startIso, 60);

        const payload = {
            summary: event.title || '',
            description: event.description || ''
        };
        if (allDay) {
            const startDate = dateOnly(event.start) || dateOnly(startIso);
            const endDate = dateOnly(event.end) || null;
            payload.start = { date: startDate };
            payload.end = { date: endDate || startDate };
        } else {
            payload.start = { dateTime: startIso };
            payload.end = { dateTime: endIso };
        }

        const res = await axios.post(url, payload, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        return String(res.data?.id);
    }

    if (provider === 'naverworks') {
        const cfg = getNaverWorksConfig();
        const base = cfg.apiBase.replace(/\/+$/, '');
        const url = `${base}/calendar/v1/calendars/${encodeURIComponent(providerCalendarId)}/events`;

        const startIso = asIsoDateTime(event.start);
        if (!startIso) throw new Error('Invalid event start datetime');
        const endIso = asIsoDateTime(event.end) || addMinutesIso(startIso, 60);

        const payload = {
            title: event.title || '',
            description: event.description || '',
            allDay: !!event.allDay,
            start: startIso,
            end: endIso
        };

        const res = await axios.post(url, payload, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        const id = res.data?.id || res.data?.eventId || res.data?.event_id;
        if (!id) throw new Error('NAVER WORKS create event: missing event id in response');
        return String(id);
    }

    throw new Error('Unsupported provider');
}

async function updateProviderEvent({ provider, accessToken, providerCalendarId, providerEventId, event }) {
    if (provider === 'google') {
        const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(providerCalendarId)}/events/${encodeURIComponent(providerEventId)}`;
        const allDay = !!event.allDay;
        const startIso = asIsoDateTime(event.start);
        if (!startIso) throw new Error('Invalid event start datetime');
        const endIso = asIsoDateTime(event.end) || addMinutesIso(startIso, 60);

        const payload = {
            summary: event.title || '',
            description: event.description || ''
        };
        if (allDay) {
            const startDate = dateOnly(event.start) || dateOnly(startIso);
            const endDate = dateOnly(event.end) || null;
            payload.start = { date: startDate };
            payload.end = { date: endDate || startDate };
        } else {
            payload.start = { dateTime: startIso };
            payload.end = { dateTime: endIso };
        }

        await axios.patch(url, payload, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        return;
    }

    if (provider === 'naverworks') {
        const cfg = getNaverWorksConfig();
        const base = cfg.apiBase.replace(/\/+$/, '');
        const url = `${base}/calendar/v1/calendars/${encodeURIComponent(providerCalendarId)}/events/${encodeURIComponent(providerEventId)}`;
        const startIso = asIsoDateTime(event.start);
        if (!startIso) throw new Error('Invalid event start datetime');
        const endIso = asIsoDateTime(event.end) || addMinutesIso(startIso, 60);
        const payload = {
            title: event.title || '',
            description: event.description || '',
            allDay: !!event.allDay,
            start: startIso,
            end: endIso
        };
        await axios.put(url, payload, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        return;
    }

    throw new Error('Unsupported provider');
}

async function deleteProviderEvent({ provider, accessToken, providerCalendarId, providerEventId }) {
    if (provider === 'google') {
        const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(providerCalendarId)}/events/${encodeURIComponent(providerEventId)}`;
        await axios.delete(url, { headers: { Authorization: `Bearer ${accessToken}` } });
        return;
    }

    if (provider === 'naverworks') {
        const cfg = getNaverWorksConfig();
        const base = cfg.apiBase.replace(/\/+$/, '');
        const url = `${base}/calendar/v1/calendars/${encodeURIComponent(providerCalendarId)}/events/${encodeURIComponent(providerEventId)}`;
        await axios.delete(url, { headers: { Authorization: `Bearer ${accessToken}` } });
        return;
    }

    throw new Error('Unsupported provider');
}

function getTokenEncryptionKey() {
    const raw = process.env.TOKEN_ENCRYPTION_KEY;
    if (!raw) {
        throw new Error('Missing TOKEN_ENCRYPTION_KEY (required for connected accounts token encryption)');
    }

    let key;
    const isHex = /^[0-9a-fA-F]+$/.test(raw) && raw.length === 64;
    try {
        key = Buffer.from(raw, isHex ? 'hex' : 'base64');
    } catch {
        throw new Error('Invalid TOKEN_ENCRYPTION_KEY encoding (expected 32-byte hex or base64)');
    }

    if (key.length !== 32) {
        throw new Error('Invalid TOKEN_ENCRYPTION_KEY length (expected 32 bytes)');
    }
    return key;
}

function encryptToken(plaintext) {
    if (plaintext === null || plaintext === undefined || plaintext === '') return null;
    const key = getTokenEncryptionKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return JSON.stringify({ v: 1, iv: iv.toString('base64'), tag: tag.toString('base64'), data: ciphertext.toString('base64') });
}

function decryptToken(payload) {
    if (!payload) return null;
    const key = getTokenEncryptionKey();
    let parsed;
    try {
        parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
    } catch {
        throw new Error('Failed to parse encrypted token payload');
    }
    if (!parsed || parsed.v !== 1 || !parsed.iv || !parsed.tag || !parsed.data) {
        throw new Error('Invalid encrypted token payload');
    }
    const iv = Buffer.from(parsed.iv, 'base64');
    const tag = Buffer.from(parsed.tag, 'base64');
    const data = Buffer.from(parsed.data, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(data), decipher.final()]);
    return plaintext.toString('utf8');
}

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

        // 4. Connected Accounts (OAuth tokens encrypted at rest)
        db.run(`CREATE TABLE IF NOT EXISTS connected_accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            provider TEXT NOT NULL,
            access_token_enc TEXT,
            refresh_token_enc TEXT,
            token_type TEXT,
            scope TEXT,
            expires_at INTEGER,
            created_at INTEGER,
            updated_at INTEGER,
            UNIQUE(user_id, provider),
            FOREIGN KEY(user_id) REFERENCES users(id)
        )`);

        // 5. Connected Calendars (discovered per provider account)
        db.run(`CREATE TABLE IF NOT EXISTS connected_calendars (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            account_id INTEGER NOT NULL,
            provider TEXT NOT NULL,
            provider_calendar_id TEXT NOT NULL,
            name TEXT,
            color TEXT,
            can_write INTEGER DEFAULT 0,
            is_enabled INTEGER DEFAULT 1,
            updated_at INTEGER,
            UNIQUE(user_id, provider, provider_calendar_id),
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(account_id) REFERENCES connected_accounts(id)
        )`);

        // 6. OAuth States
        db.run(`CREATE TABLE IF NOT EXISTS oauth_states (
            state TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            provider TEXT NOT NULL,
            expires_at INTEGER NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )`);

        // 7. Event External Links (local event -> provider event mapping)
        db.run(`CREATE TABLE IF NOT EXISTS event_external_links (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            provider TEXT NOT NULL,
            account_id INTEGER NOT NULL,
            provider_calendar_id TEXT NOT NULL,
            provider_event_id TEXT NOT NULL,
            UNIQUE(event_id, provider),
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(event_id) REFERENCES events(id),
            FOREIGN KEY(account_id) REFERENCES connected_accounts(id)
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

// --- OAuth (Google / NAVER WORKS) ---
app.get('/api/oauth/:provider/start', authenticateToken, async (req, res) => {
    const provider = normalizeProvider(req.params.provider);
    if (!provider) return res.status(400).json({ error: 'Unsupported provider' });

    try {
        const state = randomState();
        const expiresAt = nowMs() + 10 * 60 * 1000;
        await dbRun('INSERT INTO oauth_states (state, user_id, provider, expires_at) VALUES (?, ?, ?, ?)', [state, req.user.id, provider, expiresAt]);

        if (provider === 'google') {
            const cfg = getGoogleConfig();
            const params = new URLSearchParams({
                client_id: cfg.clientId,
                redirect_uri: cfg.redirectUri,
                response_type: 'code',
                scope: [
                    'https://www.googleapis.com/auth/calendar.readonly',
                    'https://www.googleapis.com/auth/calendar.events'
                ].join(' '),
                access_type: 'offline',
                prompt: 'consent',
                include_granted_scopes: 'true',
                state
            });
            const authUrl = `${cfg.authUrl}?${params.toString()}`;
            return res.json({ message: 'success', authUrl });
        }

        if (provider === 'naverworks') {
            const cfg = getNaverWorksConfig();
            const scope = process.env.NAVERWORKS_SCOPE || 'calendar';
            const params = new URLSearchParams({
                client_id: cfg.clientId,
                redirect_uri: cfg.redirectUri,
                response_type: 'code',
                scope,
                state
            });
            const authUrl = `${cfg.authUrl}?${params.toString()}`;
            return res.json({ message: 'success', authUrl });
        }

        return res.status(400).json({ error: 'Unsupported provider' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/oauth/:provider/callback', async (req, res) => {
    const provider = normalizeProvider(req.params.provider);
    if (!provider) return res.status(400).json({ error: 'Unsupported provider' });

    const code = req.query.code;
    const state = req.query.state;
    if (!code || !state) return res.status(400).json({ error: 'Missing code/state' });

    try {
        const row = await dbGet('SELECT state, user_id, provider, expires_at FROM oauth_states WHERE state = ? AND provider = ?', [state, provider]);
        if (!row) return res.status(400).json({ error: 'Invalid state' });
        if (Number(row.expires_at) < nowMs()) {
            await dbRun('DELETE FROM oauth_states WHERE state = ?', [state]);
            return res.status(400).json({ error: 'State expired' });
        }

        // One-time state
        await dbRun('DELETE FROM oauth_states WHERE state = ?', [state]);
        const userId = row.user_id;

        let tokenData;
        if (provider === 'google') {
            const cfg = getGoogleConfig();
            const body = new URLSearchParams({
                code: String(code),
                client_id: cfg.clientId,
                client_secret: cfg.clientSecret,
                redirect_uri: cfg.redirectUri,
                grant_type: 'authorization_code'
            });
            const tokenRes = await axios.post(cfg.tokenUrl, body.toString(), {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });
            tokenData = tokenRes.data;
        } else if (provider === 'naverworks') {
            const cfg = getNaverWorksConfig();
            const body = new URLSearchParams({
                code: String(code),
                client_id: cfg.clientId,
                client_secret: cfg.clientSecret,
                redirect_uri: cfg.redirectUri,
                grant_type: 'authorization_code'
            });
            const tokenRes = await axios.post(cfg.tokenUrl, body.toString(), {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });
            tokenData = tokenRes.data;
        }

        if (!tokenData?.access_token) {
            return res.status(400).json({ error: 'Token exchange failed' });
        }

        const { id: accountId } = await upsertConnectedAccount({ userId, provider, tokenResponse: tokenData });
        await fetchAndUpsertProviderCalendars({ userId, provider, accountId, accessToken: tokenData.access_token });

        return res.redirect(`${getClientUrl()}/?connected=${encodeURIComponent(provider)}`);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/connected-calendars', authenticateToken, async (req, res) => {
    try {
        const rows = await dbAll(
            `SELECT id, provider, provider_calendar_id, name, color, can_write, is_enabled, account_id
             FROM connected_calendars
             WHERE user_id = ?
             ORDER BY provider ASC, name ASC`,
            [req.user.id]
        );
        res.json({ message: 'success', data: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Events: Get All (User Specific + External)
app.get('/api/events', authenticateToken, async (req, res) => {
    const userId = req.user.id;

    // 1. Fetch Local Events
    const getLocalEvents = new Promise((resolve, reject) => {
        db.all(
            `SELECT e.*, 
                    eel.provider AS external_provider,
                    eel.provider_event_id AS external_provider_event_id,
                    cc.id AS connected_calendar_id
             FROM events e
             LEFT JOIN event_external_links eel
               ON eel.event_id = e.id AND eel.user_id = e.user_id
             LEFT JOIN connected_calendars cc
               ON cc.user_id = e.user_id
              AND cc.provider = eel.provider
              AND cc.provider_calendar_id = eel.provider_calendar_id
             WHERE e.user_id = ?`,
            [userId],
            (err, rows) => {
            if (err) reject(err);
            else resolve(rows.map(r => ({
                ...r,
                allDay: !!r.allDay,
                completed: !!r.completed,
                is_provider_linked: !!r.external_provider,
                connected_calendar_id: r.connected_calendar_id ? Number(r.connected_calendar_id) : null
            })));
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
                                    title: ev.summary || '',
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
app.post('/api/events', authenticateToken, async (req, res) => {
    const { title, start, end, allDay, description, color, connectedCalendarId } = req.body;

    try {
        if (!connectedCalendarId) {
            const sql = 'INSERT INTO events (user_id, title, start, end, allDay, description, color) VALUES (?,?,?,?,?,?,?)';
            const params = [req.user.id, title, start, end, allDay ? 1 : 0, description, color];
            db.run(sql, params, function (err) {
                if (err) {
                    res.status(400).json({ "error": err.message });
                    return;
                }
                res.json({ message: "success", data: { id: this.lastID, ...req.body } });
            });
            return;
        }

        const cc = await dbGet(
            'SELECT * FROM connected_calendars WHERE id = ? AND user_id = ? AND is_enabled = 1',
            [connectedCalendarId, req.user.id]
        );
        if (!cc) return res.status(404).json({ error: 'Connected calendar not found' });
        if (!cc.can_write) return res.status(403).json({ error: 'Calendar is read-only' });

        const account = await dbGet(
            'SELECT * FROM connected_accounts WHERE id = ? AND user_id = ? AND provider = ?',
            [cc.account_id, req.user.id, cc.provider]
        );
        if (!account) return res.status(404).json({ error: 'Connected account not found' });

        const { accessToken } = await refreshAccessTokenIfNeeded(account);
        const provider = normalizeProvider(cc.provider);

        const providerEventId = await createProviderEvent({
            provider,
            accessToken,
            providerCalendarId: cc.provider_calendar_id,
            event: { title, start, end, allDay, description, color }
        });

        const insert = await dbRun(
            'INSERT INTO events (user_id, title, start, end, allDay, description, color) VALUES (?,?,?,?,?,?,?)',
            [req.user.id, title, start, end, allDay ? 1 : 0, description, color]
        );
        const localEventId = insert.lastID;

        await dbRun(
            `INSERT INTO event_external_links (event_id, user_id, provider, account_id, provider_calendar_id, provider_event_id)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [localEventId, req.user.id, provider, account.id, cc.provider_calendar_id, providerEventId]
        );

        res.json({
            message: 'success',
            data: {
                id: localEventId,
                title,
                start,
                end,
                allDay,
                description,
                color,
                is_provider_linked: true,
                connected_calendar_id: Number(cc.id),
                external_provider: provider
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. Events: Update
app.put('/api/events/:id', authenticateToken, async (req, res) => {
    const eventId = req.params.id;
    const { title, start, end, allDay, description, color, completed } = req.body;

    try {
        const existing = await dbGet('SELECT * FROM events WHERE id = ? AND user_id = ?', [eventId, req.user.id]);
        if (!existing) return res.status(404).json({ error: 'Event not found' });

        const link = await dbGet(
            'SELECT * FROM event_external_links WHERE event_id = ? AND user_id = ?',
            [eventId, req.user.id]
        );

        if (link) {
            const provider = normalizeProvider(link.provider);
            const account = await dbGet(
                'SELECT * FROM connected_accounts WHERE id = ? AND user_id = ? AND provider = ?',
                [link.account_id, req.user.id, provider]
            );
            if (!account) return res.status(404).json({ error: 'Connected account not found' });
            const { accessToken } = await refreshAccessTokenIfNeeded(account);

            const merged = {
                title: title !== undefined ? title : existing.title,
                start: start !== undefined ? start : existing.start,
                end: end !== undefined ? end : existing.end,
                allDay: allDay !== undefined ? allDay : !!existing.allDay,
                description: description !== undefined ? description : existing.description,
                color: color !== undefined ? color : existing.color
            };
            await updateProviderEvent({
                provider,
                accessToken,
                providerCalendarId: link.provider_calendar_id,
                providerEventId: link.provider_event_id,
                event: merged
            });
        }

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
            title,
            start,
            end,
            allDay !== undefined ? (allDay ? 1 : 0) : undefined,
            description,
            color,
            completed !== undefined ? (completed ? 1 : 0) : undefined,
            eventId,
            req.user.id
        ];

        db.run(sql, params, function (err) {
            if (err) return res.status(400).json({ "error": err.message });
            res.json({ "message": "success", "changes": this.changes });
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 6. Events: Delete
app.delete('/api/events/:id', authenticateToken, async (req, res) => {
    const eventId = req.params.id;
    try {
        const link = await dbGet(
            'SELECT * FROM event_external_links WHERE event_id = ? AND user_id = ?',
            [eventId, req.user.id]
        );

        if (link) {
            const provider = normalizeProvider(link.provider);
            const account = await dbGet(
                'SELECT * FROM connected_accounts WHERE id = ? AND user_id = ? AND provider = ?',
                [link.account_id, req.user.id, provider]
            );
            if (!account) return res.status(404).json({ error: 'Connected account not found' });
            const { accessToken } = await refreshAccessTokenIfNeeded(account);
            await deleteProviderEvent({
                provider,
                accessToken,
                providerCalendarId: link.provider_calendar_id,
                providerEventId: link.provider_event_id
            });
        }

        db.run('DELETE FROM events WHERE id = ? AND user_id = ?', [eventId, req.user.id], async function (err) {
            if (err) return res.status(400).json({ "error": err.message });
            if (this.changes) {
                try {
                    await dbRun('DELETE FROM event_external_links WHERE event_id = ? AND user_id = ?', [eventId, req.user.id]);
                } catch {
                    // Ignore mapping cleanup error
                }
            }
            res.json({ "message": "deleted", changes: this.changes });
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
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

// 9. External Calendars: Update
app.put('/api/calendars/:id', authenticateToken, (req, res) => {
    const { url, name, color } = req.body;

    if (url === undefined && name === undefined && color === undefined) {
        return res.status(400).json({ error: "No fields to update." });
    }

    const sql = `UPDATE external_calendars SET 
                 url = COALESCE(?, url), 
                 name = COALESCE(?, name), 
                 color = COALESCE(?, color) 
                 WHERE id = ? AND user_id = ?`;

    db.run(sql, [url, name, color, req.params.id, req.user.id], function (err) {
        if (err) return res.status(400).json({ error: err.message });
        res.json({ message: 'success', changes: this.changes });
    });
});

// 10. External Calendars: Delete
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
