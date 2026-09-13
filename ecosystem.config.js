// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: "pickembot",
      cwd: "/home/container",
      script: "index.js",
      env: {
        NODE_ENV: "production",
        GUILD_CONFIG_DIR: "config",
      },
      autorestart: true,
      restart_delay: 2000,
      max_restarts: 50,
      kill_timeout: 10000,
    },
  ],
};