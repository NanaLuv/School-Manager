const mysql = require("mysql2/promise");
const dotenv = require("dotenv");
dotenv.config();

const MYSQL_PUBLIC_URL =
  "mysql://${process.env.MYSQLUSER}:${process.env.MYSQL_ROOT_PASSWORD}@${process.env.RAILWAY_TCP_PROXY_DOMAIN}}:${process.env.RAILWAY_TCP_PROXY_PORT}/${process.env.MYSQL_DATABASE}";

const pool = mysql.createPool(MYSQL_PUBLIC_URL);

module.exports = pool;
