const mysql = require("mysql2/promise");
const dotenv = require("dotenv");
dotenv.config();


const pool = mysql.createPool(process.env.DATABASE_URL, {
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

module.exports = pool;
