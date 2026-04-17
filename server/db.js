const mysql = require("mysql2/promise");
const dotenv = require("dotenv");
dotenv.config();

const connectionUrl = process.env.MYSQL_PUBLIC_URL;
const pool = mysql.createPool(connectionUrl);

module.exports = pool;
