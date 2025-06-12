const mysql = require('mysql2');
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root', // change if different
  password: 'Buinga@2027', // change if needed
  database: 'crewtrack'
});

connection.connect(err => {
  if (err) throw err;
  console.log('MySQL connected!');
});

module.exports = connection;
