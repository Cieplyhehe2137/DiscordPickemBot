// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: "pickembot",
      cwd: "/home/container",
      script: "index.js",
      env: {
        NODE_ENV: "production",
        // ważne: nie ENV_FILE
        // bo teraz guildRegistry sam wczyta wszystkie pliki z folderu config/*.env
        GUILD_CONFIG_DIR: "config"
      },
      autorestart: true,
      restart_delay: 2000,
      max_restarts: 50,
    }
  ],
};
