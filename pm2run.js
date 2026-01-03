// pm2run.js

process.argv = [
    process.execPath,
    "pm2-runtime",
    "ecosystem.config.js"
];

require("/node_modules/pm2/bin/pm2-runtime");