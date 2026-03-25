// Configuración de conexión a MySQL - Hostinger
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: '127.0.0.1',
  user: 'u413558808_TarjetaFlo',
  password: 'DBProyectoHoustonDB123TEST!!!',
  database: 'u413558808_PruebaTarjetas',
  port: 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool;
