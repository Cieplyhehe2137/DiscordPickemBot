const fs = require("fs");
const path = require("path");

const mapsDir = path.join(__dirname, "..", "maps");
const handlersDir = path.join(__dirname, "..", "handlers");

function listJs(dir) {
  return fs.existsSync(dir)
    ? fs.readdirSync(dir).filter(f => f.endsWith(".js"))
    : [];
}

function loadMap(file) {
  const p = path.join(mapsDir, file);
  try {
    const mod = require(p);
    return { file, mod };
  } catch (e) {
    return { file, error: e.message };
  }
}

const handlerFiles = new Set(listJs(handlersDir).map(f => f.replace(/\.js$/, "")));
const mapFiles = listJs(mapsDir);

const referenced = new Set();
const missingHandlers = [];
const badMaps = [];

for (const mf of mapFiles) {
  const { file, mod, error } = loadMap(mf);
  if (error) { badMaps.push({ file, error }); continue; }
  if (!mod || typeof mod !== "object") continue;

  // obsługa: { customId: "handlerName" }
  for (const [k, v] of Object.entries(mod)) {
    if (typeof v !== "string") continue;
    referenced.add(v);
    if (!handlerFiles.has(v)) missingHandlers.push({ map: file, key: k, handler: v });
  }
}

const unusedHandlers = [...handlerFiles].filter(h => !referenced.has(h));

console.log("\n=== BAD MAP FILES (cannot require) ===");
for (const x of badMaps) console.log("-", x.file, "=>", x.error);

console.log("\n=== MISSING HANDLERS referenced by maps ===");
for (const x of missingHandlers) console.log("-", x.map, `[${x.key}] ->`, x.handler);

console.log("\n=== UNUSED HANDLERS (exist but not referenced) ===");
for (const h of unusedHandlers) console.log("-", h);

console.log("\nDone.");
