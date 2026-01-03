// pm2run.js

process.argv = [
    process.execPath,
    "pm2-runtime",
    "ecosystem.config.js"
];

require("pm2/bin/pm2-runtime");