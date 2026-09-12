// ecosystem.config.js
//
// UWAGA: ta lista nie opisuje calego wdrozenia. API ma drugi punkt wejscia -
// web-server.js - ktory uruchamia Plesk poza PM2. Gdy strone obsluguje on,
// `pm2 restart pickembot-server` nie ma zadnego wplywu na to, co widzi
// przegladarka. Patrz sekcja "Deploying" w README.
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
        GUILD_CONFIG_DIR: "config",
      },
      autorestart: true,
      restart_delay: 2000,
      max_restarts: 50,
      // Domyslne 1600 ms PM2 nie wystarcza na zamkniecie puli MySQL i
      // rozlaczenie z Discordem - proces dostawalby SIGKILL w polowie.
      // Wlasny bezpiecznik w utils/gracefulShutdown.js wychodzi po 8 s,
      // wiec 10 s zostawia zapas i nigdy nie powinno sie tu dojsc.
      kill_timeout: 10000,
    },
    {
      // API + strona web (serwowana statycznie z web/dist w produkcji -
      // patrz server/index.js). Sekrety (DB, Discord OAuth, SESSION_SECRET,
      // WEB_ORIGIN, PORT) czytane z server/.env przez dotenv, nie stąd -
      // ten sam wzorzec co GUILD_CONFIG_DIR dla bota powyżej.
      name: "pickembot-server",
      cwd: "/home/container/server",
      script: "index.js",
      env: {
        NODE_ENV: "production",
      },
      autorestart: true,
      restart_delay: 2000,
      max_restarts: 50,
      // Domyslne 1600 ms PM2 nie wystarcza na zamkniecie puli MySQL i
      // rozlaczenie z Discordem - proces dostawalby SIGKILL w polowie.
      // Wlasny bezpiecznik w utils/gracefulShutdown.js wychodzi po 8 s,
      // wiec 10 s zostawia zapas i nigdy nie powinno sie tu dojsc.
      kill_timeout: 10000,
    },
  ],
};
