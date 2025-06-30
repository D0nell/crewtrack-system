console.log("✅ routes.js loaded");

const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const db = require('./db');

router.get('/test', (req, res) => {
  res.json({ message: "Test route is working!" });
});

router.get('/shifts/completed', (req, res) => {
  const query = `
    SELECT 
      s.shift_id,
      u.name AS user_name,
      s.zone_assigned,
      s.shift_date,
      s.shift_start,
      s.shift_end,
      s.status,
      a.check_in,
      a.check_out
    FROM shifts s
    JOIN users u ON s.user_id = u.user_id
    LEFT JOIN attendance a ON s.shift_id = a.shift_id
    WHERE s.status = 'completed'
    ORDER BY s.shift_date DESC, s.shift_start DESC
  `;

  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// ---------------- USER AUTH ----------------

const ADMIN_CODES = { supervisor: "SV1234", manager: "HM2024" };

router.post('/register', async (req, res) => {
  const { name, email, password, role, adminCode } = req.body;

  if ((role === "supervisor" || role === "manager") && adminCode !== ADMIN_CODES[role]) {
    return res.status(403).json({ error: `Invalid verification code for ${role}` });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const query = `INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)`;
    db.query(query, [name, email, hashedPassword, role], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'User registered successfully!' });
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error during registration.' });
  }
});

router.post('/login', (req, res) => {
  const { email, password, role } = req.body;
  const query = `SELECT * FROM users WHERE email = ? AND role = ?`;

  db.query(query, [email, role], async (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(401).json({ error: 'User not found' });

    const isMatch = await bcrypt.compare(password, results[0].password_hash);
    if (!isMatch) return res.status(401).json({ error: 'Incorrect password' });

    res.json({ message: 'Login successful', user: results[0] });
  });
});

// ---------------- ATTENDANCE ----------------

router.post('/attendance/checkin', (req, res) => {
  const { user_id, shift_id } = req.body;

  // 🔍 Log the request body
  console.log("📥 Check-in Request Received:", req.body);

  if (!user_id || !shift_id) {
    return res.status(400).json({ error: "Missing user_id or shift_id." });
  }

  const now = new Date();

  // Step 1: Check if user already checked in
  db.query(
    `SELECT check_in FROM attendance WHERE user_id = ? AND shift_id = ?`,
    [user_id, shift_id],
    (err, results) => {
      if (err) {
        console.error("❌ Error checking existing check-in:", err);
        return res.status(500).json({ error: err.message });
      }

      if (results.length > 0 && results[0].check_in) {
        return res.status(400).json({ error: "You have already checked in for this shift." });
      }

      // Step 2: Proceed with check-in if not already done
      db.query(
        `INSERT INTO attendance (user_id, shift_id, check_in)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE check_in = VALUES(check_in)`,
        [user_id, shift_id, now],
        (insertErr) => {
          if (insertErr) {
            console.error("❌ Error inserting check-in:", insertErr);
            return res.status(500).json({ error: insertErr.message });
          }

          console.log("✅ Check-in successful for user:", user_id);
          res.json({ message: 'Checked in successfully' });
        }
      );
    }
  );
});


router.post('/attendance/checkout', (req, res) => {
  const { user_id, shift_id } = req.body;
  const now = new Date();

  const updateQuery = `
    UPDATE attendance
    SET check_out = ?
    WHERE user_id = ? AND shift_id = ? AND check_in IS NOT NULL AND check_out IS NULL
  `;

  db.query(updateQuery, [now, user_id, shift_id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    if (result.affectedRows === 0) {
      return res.status(400).json({ error: 'No check-in found or already checked out.' });
    }

    db.query(`UPDATE shifts SET status = 'completed' WHERE shift_id = ?`, [shift_id], (err2) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ message: 'Checked out. Shift completed.' });
    });
  });
});

router.get('/attendance/history', (req, res) => {
  const { user_id } = req.query;

  if (!user_id) {
    return res.status(400).json({ error: 'Missing user_id' });
  }

  const query = `
    SELECT s.shift_id, s.shift_date, s.shift_start, s.shift_end, s.zone_assigned, 
           a.check_in, a.check_out
    FROM shifts s
    LEFT JOIN attendance a ON s.shift_id = a.shift_id AND s.user_id = a.user_id
    WHERE s.user_id = ? AND s.status = 'completed'
    ORDER BY s.shift_date DESC, s.shift_start DESC
  `;

  db.query(query, [user_id], (err, results) => {
    if (err) {
      console.error('Error fetching history:', err);
      return res.status(500).json({ error: err.message });
    }

    res.json(results);
  });
});

// ---------------- PAYROLL ----------------

router.post('/payroll/generate', (req, res) => {
  const { week_start, week_end } = req.body;
  const query = `
    SELECT 
      a.user_id, u.name, u.hourly_rate,
      SUM(TIMESTAMPDIFF(SECOND, a.check_in, a.check_out)) AS total_seconds
    FROM attendance a
    JOIN users u ON a.user_id = u.user_id
    JOIN shifts s ON a.shift_id = s.shift_id
    WHERE s.shift_date BETWEEN ? AND ? 
      AND a.check_in IS NOT NULL AND a.check_out IS NOT NULL
    GROUP BY a.user_id
  `;

  db.query(query, [week_start, week_end], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.json({ message: 'No data to generate payroll' });

    const payrolls = results.map(row => {
      const hours = parseFloat((row.total_seconds / 3600).toFixed(2));
      const rate = row.hourly_rate || 200;
      const pay = parseFloat((hours * rate).toFixed(2));

      return [row.user_id, week_start, week_end, hours, pay, 'pending'];
    });

    db.query(
      `INSERT INTO payroll (user_id, week_start, week_end, total_hours, total_pay, status) VALUES ?`,
      [payrolls],
      (err2) => {
        if (err2) return res.status(500).json({ error: err2.message });
        res.json({ message: 'Payroll generated successfully.', count: payrolls.length });
      }
    );
  });
});

router.get('/payroll/list', (req, res) => {
  const { status, user_id, start, end } = req.query;
  let query = `
    SELECT p.*, u.name AS staff_name, u.email
    FROM payroll p
    JOIN users u ON p.user_id = u.user_id
    WHERE 1=1
  `;
  const params = [];

  if (status) { query += ' AND p.status = ?'; params.push(status); }
  if (user_id) { query += ' AND p.user_id = ?'; params.push(user_id); }
  if (start) { query += ' AND p.week_start >= ?'; params.push(start); }
  if (end) { query += ' AND p.week_end <= ?'; params.push(end); }

  query += ' ORDER BY p.week_start DESC';

  db.query(query, params, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

router.post('/payroll/approve', (req, res) => {
  const { payroll_id, manager_id } = req.body;

  db.query(
    `UPDATE payroll SET status = 'approved', approved_by = ? WHERE payroll_id = ?`,
    [manager_id, payroll_id],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Payroll approved successfully.' });
    }
  );
});

// ---------------- SHIFTS ----------------

router.post('/shifts/assign', (req, res) => {
  const { user_id, shift_date, shift_start, shift_end, zone_assigned } = req.body;

  const query = `
    INSERT INTO shifts (user_id, shift_date, shift_start, shift_end, zone_assigned, status)
    VALUES (?, ?, ?, ?, ?, 'pending')
  `;

  db.query(query, [user_id, shift_date, shift_start, shift_end, zone_assigned], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Shift assigned successfully.' });
  });
});

router.get('/shifts/today', (req, res) => {
  const { user_id } = req.query;
  const today = new Date().toISOString().slice(0, 10); 


  console.log(">>> Fetching today's shift:");
  console.log("User ID:", user_id);
  console.log("Today:", today);

  const query = `
    SELECT shift_id, user_id, shift_date, shift_start, shift_end, zone_assigned, status
    FROM shifts
    WHERE user_id = ? AND DATE(shift_date) = ?
  `;

  db.query(query, [user_id, today], (err, results) => {
    if (err) {
      console.error("DB error:", err);
      return res.status(500).json({ error: err.message });
    }
    console.log("Results:", results); //  See what the DB returns
    res.json(results);
  });
});



router.get('/shifts/mine-all/:userId', (req, res) => {
  const { userId } = req.params;
  const today = new Date().toISOString().split('T')[0];

  const query = `
    SELECT shift_id, shift_date, shift_start, shift_end, zone_assigned, status
    FROM shifts
    WHERE user_id = ? AND shift_date >= ?
    ORDER BY shift_date ASC
  `;

  db.query(query, [userId, today], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(results);
  });
});




// ---------------- STAFF ----------------

router.get('/users/staff', (req, res) => {
  db.query(
    `SELECT user_id, name, email, role FROM users WHERE role IN ('housekeeper', 'supervisor')`,
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(results);
    }
  );
});

// ---------------- REPORTS ----------------

router.get('/reports/shifts', (req, res) => {
  const query = `
    SELECT 
      SUM(status = 'pending') AS pending,
      SUM(status = 'completed') AS completed,
      SUM(status = 'missed') AS missed
    FROM shifts
  `;

  db.query(query, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(result[0]);
  });
});

router.get('/reports/attendance', (req, res) => {
  const query = `
    SELECT 
      COUNT(check_in) AS checked_in,
      COUNT(check_out) AS checked_out
    FROM attendance
  `;

  db.query(query, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(result[0]);
  });
});

// ---------------- NEXT UPCOMING SHIFT FOR USER ----------------

router.get('/shifts/next/:user_id', (req, res) => {
  const { user_id } = req.params;

  const query = `
    SELECT shift_id, shift_date, shift_start, shift_end, zone_assigned, status
    FROM shifts
    WHERE user_id = ?
      AND (shift_date > CURDATE() OR (shift_date = CURDATE() AND shift_start > CURTIME()))
    ORDER BY shift_date ASC, shift_start ASC
    LIMIT 1
  `;

  db.query(query, [user_id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results); // return as array, even if empty
  });
});

// Get all attendance records (for Supervisor view)
router.get('/attendance/all', (req, res) => {
  const query = `
    SELECT 
      a.attendance_id,
      u.name AS user_name,
      s.zone_assigned,
      s.shift_date,
      s.shift_start,
      s.shift_end,
      a.check_in,
      a.check_out
    FROM attendance a
    JOIN users u ON a.user_id = u.user_id
    JOIN shifts s ON a.shift_id = s.shift_id
    ORDER BY s.shift_date DESC, s.shift_start DESC
  `;

  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});





module.exports = router;
