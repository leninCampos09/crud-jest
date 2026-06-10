const mysql = require("mysql2/promise");
require("dotenv").config();
(async () => {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "tarea_poo",
  });
  try {
    const [rows] = await pool.query("SHOW COLUMNS FROM usuarios");
    console.log("columns:", rows.map((r) => r.Field).join(", "));
    const [r2] = await pool.query(
      "SELECT id, nombre, email, avatar FROM usuarios LIMIT 1",
    );
    console.log("sample row:", r2[0]);
  } catch (err) {
    console.error("error:", err.message);
  } finally {
    await pool.end();
  }
})();
