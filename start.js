// start.js
const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");
const validateConfig = require("./validateConfig");

// 1) Wybór pliku env
const envFile = process.env.ENV_FILE || ".env";
const envPath = path.resolve(__dirname, envFile);

// 2) Załaduj env jeśli plik istnieje
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log(`✅ Loaded env from: ${envFile}`);
} else {
  console.warn(`⚠️ Env file not found: ${envFile} (${envPath})`);
  // próbuj fallback
  const fallback = path.resolve(__dirname, ".env");
  if (fs.existsSync(fallback)) {
    dotenv.config({ path: fallback });
    console.log("✅ Loaded fallback .env");
  }
}

// 3) Start bota (podmień jeśli entrypoint masz inny)
if (process.env.VALIDATE_CONFIG === 'true') {
  validateConfig();
}
require("./index.js");
