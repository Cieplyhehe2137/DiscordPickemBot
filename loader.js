const fs = require("fs");
const path = require("path");

// Walks `dir` recursively so handlers can live in domain subfolders
// (handlers/swiss/, handlers/playoffs/, ...). Keys stay flat basenames
// (e.g. 'submitSwissDropdown'), matching what maps/*.js already expects —
// moving a handler into a subfolder doesn't require touching the maps.
function loadHandlers(dir) {
  const handlers = {};
  const rootDir = path.join(__dirname, dir);

  function walk(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }

      if (entry.name.endsWith(".js")) {
        const key = entry.name.replace(/\.js$/, "");

        if (handlers[key]) {
          throw new Error(
            `[loader] Duplicate handler name "${key}" (${fullPath} vs a previously loaded file). Handler basenames must be unique across all subfolders.`,
          );
        }

        handlers[key] = require(fullPath);
      }
    }
  }

  walk(rootDir);
  return handlers;
}

module.exports = { loadHandlers };
