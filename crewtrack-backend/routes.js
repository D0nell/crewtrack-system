const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const db = require('./db');

// Register
router.post('/register', async (req, res) => {
  const { name, email, password, role, adminCode } = req.body;

  // Admin code verification
  const ADMIN_CODES = {
    supervisor: "SV1234",
    manager: "HM2024"
  };

  // If the role requires verification and the code is wrong
  if ((role === "supervisor" || role === "manager") && adminCode !== ADMIN_CODES[role]) {
    return res.status(403).json({ error: `Invalid verification code for ${role}` });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    db.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [name, email, hashedPassword, role],
      (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'User registered successfully!' });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Server error during registration.' });
  }
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

// Get all housekeepers and supervisors
router.get('/users/staff', (req, res) => {
  db.query(
    "SELECT user_id, name, email, role FROM users WHERE role IN ('housekeeper', 'supervisor')",
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(results);
    }
  );
});

// Get pending payrolls
router.get('/payroll/pending', (req, res) => {
  const query = `
    SELECT p.payroll_id, u.name AS staff_name, u.email, p.week_start, p.week_end, p.total_hours, p.total_pay
    FROM payroll p
    JOIN users u ON p.user_id = u.user_id
    WHERE p.status = 'pending'
  `;

  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// Approve a payroll entry
router.post('/payroll/approve/:id', (req, res) => {
  const payrollId = req.params.id;

  db.query(
    "UPDATE payroll SET status = 'approved' WHERE payroll_id = ?",
    [payrollId],
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Payroll approved successfully.' });
    }
  );
});

// Get weekly attendance summary (count per weekday)
router.get('/attendance/summary', (req, res) => {
  const sql = `
    SELECT 
      DAYNAME(check_in) AS day,
      COUNT(*) AS count
    FROM attendance
    WHERE check_in IS NOT NULL
    GROUP BY day
    ORDER BY FIELD(day, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')
  `;

  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });

    const labels = results.map(row => row.day);
    const data = results.map(row => row.count);
    res.json({ labels, data });
  });
});

// Shift summary for chart
router.get('/shifts/summary', (req, res) => {
  const sql = `
    SELECT DATE(shift_date) AS day, COUNT(*) AS count
    FROM shifts
    GROUP BY DATE(shift_date)
    ORDER BY day ASC
  `;
  
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });

    const labels = results.map(r => r.day);
    const data = results.map(r => r.count);
    res.json({ labels, data });
  });
});

// Route: GET /api/reports/shifts
router.get('/reports/shifts', (req, res) => {
  const query = `
    SELECT 
      SUM(status = 'pending') AS pending,
      SUM(status = 'completed') AS completed,
      SUM(status = 'missed') AS missed
    FROM shifts;
  `;

  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results[0]);
  });
});

// Route: GET /api/reports/attendance
router.get('/reports/attendance', (req, res) => {
  const query = `
    SELECT 
      COUNT(check_in) AS checked_in,
      COUNT(check_out) AS checked_out
    FROM attendance;
  `;

  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results[0]);
  });
});



module.exports = router;
