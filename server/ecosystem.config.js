// PM2 ecosystem config for School-Manager server
// Usage:
//   pm2 start ecosystem.config.js
//   pm2 startup && pm2 save   (so it survives server reboots)
//
// Place this file in your server/ folder, alongside server.js and package.json.

module.exports = {
  apps: [
    {
      name: "Trackers",
      script: "server.js",
      cwd: __dirname,

      // Cluster mode: spawns one process per CPU core and load-balances
      // requests across them automatically (round-robin).
      exec_mode: "cluster",
      instances: "max", // use "max" for all cores, or a fixed number e.g. 2

      // Restart behavior
      autorestart: true,
      watch: false, // keep false in production — true reloads on every file change
      max_memory_restart: "300M", // restart an instance if it exceeds this (tune as needed)

      env: {
        NODE_ENV: "production",
        PORT: 5000, // matches your server.js: process.env.PORT || process.env.SERVER_PORT || 5000
      },

      // Logs
      error_file: "./logs/pm2-error.log",
      out_file: "./logs/pm2-out.log",
      merge_logs: true,
      time: true,
    },
  ],
};
