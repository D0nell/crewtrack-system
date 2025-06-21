const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const authRoutes = require('./routes');

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.use('/api', authRoutes); // routes will be under /api/register and /api/login

app.listen(5000, () => {
  console.log('Server running on http://localhost:5000');
});

