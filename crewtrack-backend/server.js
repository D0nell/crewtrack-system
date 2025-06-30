const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const routes = require('./routes'); // ✅ make sure it's './routes' (without .js)

const app = express();
const PORT = 5000;

app.use(cors());
app.use(bodyParser.json());

app.use('/api', routes); // ✅ Mount all routes under /api

// Test root route
app.get('/', (req, res) => {
  res.send('CrewTrack API is running!');
});

// 404 handler (keep this last)
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
