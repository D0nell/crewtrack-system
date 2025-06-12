const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const db = require('./db');

// Register
router.post('/register', async (req, res) => {
  const { name, email, password, role } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);

  db.query(
    'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
    [name, email, hashedPassword, role],
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'User registered successfully!' });
    }
  );
});

// Login
router.post('/login', (req, res) => {
  const { email, password, role } = req.body;

  db.query('SELECT * FROM users WHERE email = ? AND role = ?', [email, role], async (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(401).json({ error: 'User not found' });

    const isMatch = await bcrypt.compare(password, results[0].password_hash);
    if (!isMatch) return res.status(401).json({ error: 'Incorrect password' });

    res.json({ message: 'Login successful', user: results[0] });
  });
});

module.exports = router;
