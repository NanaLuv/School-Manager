const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const pool = require("./db");
const router = require("./router/routes");
const path = require("path");
dotenv.config();

const app = express();

// cors configuration to allow requests from the frontend URL

app.use(
  cors(),
  // cors({
  //   origin:
  //     "https://school-manager-rhab.vercel.app" ||
  //     "school-manager-rhab-git-main-nana-loves-projects.vercel.app" ||
  //     "school-manager-rhab-6t2mgp4tt-nana-loves-projects.vercel.app",
  //   methods: ["GET", "POST", "PUT", "DELETE"],
  //   allowedHeaders: ["Content-Type", "Authorization"],
  // }),
);
app.get("/test", (req, res) => {
  res.json({ message: "CORS working" });
});

app.get("/health", async (req, res) => {
  try {
    const connection = await pool.getConnection();
    connection.release();
    res.status(200).json({ status: "ok", db: "connected" });
  } catch (err) {
    res.status(503).json({ status: "error", db: "unreachable" });
  }
});

app.use(express.json());

app.use("/schmgt", router);
app.use("/uploads", express.static("uploads"));
app.use("/uploads/school-logo", express.static("uploads/school-logo"));

// // For production, serve static files if needed
app.use(express.static(path.join(__dirname, "../client/build")));

// Catch-all: serve React app for any non-API route
app.get("/{*path}", (req, res) => {
  res.sendFile(path.join(__dirname, "../client/build", "index.html"));
});
const port = process.env.PORT || process.env.SERVER_PORT || 5000;

async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log("Database connected successfully");
    connection.release();
  } catch (err) {
    console.error("Database connection failed:", err);
    process.exit(1);
    // console.error("DB failed, but keeping server alive");
  }
}

app.listen(port, "0.0.0.0", () => {
  console.log("Server running on port " + port);
  testConnection();
});

module.exports = app;
