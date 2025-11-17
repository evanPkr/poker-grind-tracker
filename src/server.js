const express = require('express');
const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'votre-secret-super-securise-changez-moi';
const DB_PATH = path.join(__dirname, '../data.db');

let db;

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../public')));

// Initialize database
async function initDatabase() {
  const SQL = await initSqlJs();
  
  // Load existing database or create new one
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      play_time INTEGER DEFAULT 0,
      study_time INTEGER DEFAULT 0,
      games INTEGER DEFAULT 0,
      hands INTEGER DEFAULT 0,
      earnings REAL DEFAULT 0,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS player_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      player_name TEXT NOT NULL,
      category TEXT NOT NULL,
      note_text TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS bankroll (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      amount REAL DEFAULT 0,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS user_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      weekly_goals TEXT,
      session_notes TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  saveDatabase();
  console.log('✅ Database initialized');
}

// Save database to file
function saveDatabase() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

// Helper functions
function getOne(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

function getAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function runQuery(sql, params = []) {
  db.run(sql, params);
  saveDatabase();
  return { lastInsertRowid: db.exec("SELECT last_insert_rowid()")[0]?.values[0]?.[0] };
}

// Authentication middleware
const authenticate = (req, res, next) => {
  const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Non authentifié' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token invalide' });
  }
};

// Auth routes
app.post('/api/register', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Tous les champs sont requis' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Le mot de passe doit faire au moins 6 caractères' });
  }

  try {
    // Check if user exists
    const existing = getOne('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
    if (existing) {
      return res.status(400).json({ error: 'Nom d\'utilisateur ou email déjà utilisé' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    const result = runQuery(
      'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
      [username, email, hashedPassword]
    );

    const userId = result.lastInsertRowid;

    // Initialize bankroll and settings for new user
    runQuery('INSERT INTO bankroll (user_id, amount) VALUES (?, 0)', [userId]);
    runQuery('INSERT INTO user_settings (user_id) VALUES (?)', [userId]);

    const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
    
    res.cookie('token', token, { 
      httpOnly: true, 
      maxAge: 30 * 24 * 60 * 60 * 1000,
      sameSite: 'strict'
    });

    res.json({ 
      success: true, 
      user: { id: userId, username, email } 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Tous les champs sont requis' });
  }

  try {
    const user = getOne('SELECT * FROM users WHERE username = ? OR email = ?', [username, username]);

    if (!user) {
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
    
    res.cookie('token', token, { 
      httpOnly: true, 
      maxAge: 30 * 24 * 60 * 60 * 1000,
      sameSite: 'strict'
    });

    res.json({ 
      success: true, 
      user: { id: user.id, username: user.username, email: user.email } 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true });
});

app.get('/api/me', authenticate, (req, res) => {
  const user = getOne('SELECT id, username, email FROM users WHERE id = ?', [req.userId]);
  if (!user) {
    return res.status(404).json({ error: 'Utilisateur non trouvé' });
  }
  res.json({ user });
});

// Session routes
app.get('/api/sessions', authenticate, (req, res) => {
  const sessions = getAll('SELECT * FROM sessions WHERE user_id = ? ORDER BY date DESC', [req.userId]);
  res.json({ sessions });
});

app.post('/api/sessions', authenticate, (req, res) => {
  const { date, playTime, studyTime, games, hands, earnings, notes } = req.body;

  runQuery(
    'INSERT INTO sessions (user_id, date, play_time, study_time, games, hands, earnings, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [req.userId, date, playTime, studyTime, games, hands, earnings, notes || '']
  );

  // Update bankroll
  runQuery(
    'UPDATE bankroll SET amount = amount + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
    [earnings, req.userId]
  );

  res.json({ success: true });
});

app.delete('/api/sessions/:id', authenticate, (req, res) => {
  const session = getOne('SELECT * FROM sessions WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  
  if (!session) {
    return res.status(404).json({ error: 'Session non trouvée' });
  }

  // Revert bankroll change
  runQuery(
    'UPDATE bankroll SET amount = amount - ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
    [session.earnings, req.userId]
  );

  runQuery('DELETE FROM sessions WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

// Bankroll routes
app.get('/api/bankroll', authenticate, (req, res) => {
  const bankroll = getOne('SELECT amount FROM bankroll WHERE user_id = ?', [req.userId]);
  res.json({ amount: bankroll?.amount || 0 });
});

app.put('/api/bankroll', authenticate, (req, res) => {
  const { amount } = req.body;
  
  runQuery(
    'UPDATE bankroll SET amount = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
    [amount, req.userId]
  );

  res.json({ success: true, amount });
});

// Player notes routes
app.get('/api/player-notes', authenticate, (req, res) => {
  const notes = getAll('SELECT * FROM player_notes WHERE user_id = ? ORDER BY created_at DESC', [req.userId]);
  res.json({ notes });
});

app.post('/api/player-notes', authenticate, (req, res) => {
  const { playerName, category, noteText } = req.body;

  if (!playerName || !category || !noteText) {
    return res.status(400).json({ error: 'Tous les champs sont requis' });
  }

  const result = runQuery(
    'INSERT INTO player_notes (user_id, player_name, category, note_text) VALUES (?, ?, ?, ?)',
    [req.userId, playerName, category, noteText]
  );

  res.json({ 
    success: true, 
    note: {
      id: result.lastInsertRowid,
      player_name: playerName,
      category,
      note_text: noteText,
      created_at: new Date().toISOString()
    }
  });
});

app.delete('/api/player-notes/:id', authenticate, (req, res) => {
  const note = getOne('SELECT id FROM player_notes WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  
  if (!note) {
    return res.status(404).json({ error: 'Note non trouvée' });
  }

  runQuery('DELETE FROM player_notes WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

// User settings routes
app.get('/api/settings', authenticate, (req, res) => {
  const settings = getOne('SELECT weekly_goals, session_notes FROM user_settings WHERE user_id = ?', [req.userId]);
  res.json({ settings: settings || {} });
});

app.put('/api/settings', authenticate, (req, res) => {
  const { weeklyGoals, sessionNotes } = req.body;

  runQuery(
    'UPDATE user_settings SET weekly_goals = ?, session_notes = ? WHERE user_id = ?',
    [weeklyGoals || '', sessionNotes || '', req.userId]
  );

  res.json({ success: true });
});

// Stats route
app.get('/api/stats', authenticate, (req, res) => {
  const now = new Date();
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

  const allSessions = getAll('SELECT * FROM sessions WHERE user_id = ?', [req.userId]);
  const weekSessions = getAll('SELECT * FROM sessions WHERE user_id = ? AND date >= ?', [req.userId, weekAgo]);
  const monthSessions = getAll('SELECT * FROM sessions WHERE user_id = ? AND date >= ?', [req.userId, monthAgo]);

  let totalHours = 0, totalEarnings = 0;
  allSessions.forEach(s => {
    totalHours += s.play_time / 3600;
    totalEarnings += s.earnings;
  });

  let weekHours = 0, weekEarnings = 0, weekGames = 0, weekHands = 0;
  weekSessions.forEach(s => {
    weekHours += s.play_time / 3600;
    weekEarnings += s.earnings;
    weekGames += s.games;
    weekHands += s.hands;
  });

  let monthEarnings = 0;
  monthSessions.forEach(s => {
    monthEarnings += s.earnings;
  });

  res.json({
    totalHours,
    totalEarnings,
    globalHourlyRate: totalHours > 0 ? totalEarnings / totalHours : 0,
    weekHours,
    weekEarnings,
    weekGames,
    weekHands,
    monthEarnings,
    weekROI: weekGames > 0 ? (weekEarnings / (weekGames * 7.5)) * 100 : 0,
    daysThisWeek: weekSessions.length
  });
});

// Serve frontend for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start server
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`🎰 Poker Grind Tracker running on http://localhost:${PORT}`);
  });
});
