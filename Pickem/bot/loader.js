const fs = require('fs');
const path = require('path');

function loadHandlers(dir) {
  const handlers = {};
  const files = fs.readdirSync(path.join(__dirname, dir));
  for (const file of files) {
    if (file.endsWith('.js')) {
      const key = file.replace('.js', '');
      handlers[key] = require(path.join(__dirname, dir, file));
    }
  }
  return handlers;
}

module.exports = { loadHandlers };
