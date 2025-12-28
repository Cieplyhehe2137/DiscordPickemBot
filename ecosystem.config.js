// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: "pickembot-hyperland",
      cwd: "/home/container",
      script: "start.js",
      env: {
        NODE_ENV: "production",
        ENV_FILE: "config/hyperland.env",
      },
      autorestart: true,
      restart_delay: 2000,
      max_restarts: 50,
    },
    {
      name: "pickembot-luffastream",
      cwd: "/home/container",
      script: "start.js",
      env: {
        NODE_ENV: "production",
        ENV_FILE: "config/luffastream.env",
      },
      autorestart: true,
      restart_delay: 2000,
      max_restarts: 50,
    },
  ],
};
