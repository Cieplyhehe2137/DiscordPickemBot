const { DateTime } = require("luxon");

const ZONE = "Europe/Warsaw";

function parseAutoStartInput(rawInput) {
  const input = String(rawInput || "").trim();

  const dt = DateTime.fromFormat(input, "yyyy-MM-dd HH:mm", {
    zone: ZONE,
    setZone: true,
  });

  if (!dt.isValid) {
    return {
      ok: false,
      error: "Niepoprawny format. Użyj YYYY-MM-DD HH:mm, np. 2026-08-15 18:00.",
    };
  }

  const now = DateTime.now().setZone(ZONE);

  if (dt <= now) {
    return {
      ok: false,
      error: "Termin auto-startu musi być w przyszłości.",
    };
  }

  const utc = dt.toUTC();

  return {
    ok: true,
    local: dt,
    utc,
    utcDate: utc.toJSDate(),
    utcSql: utc.toFormat("yyyy-LL-dd HH:mm:ss"),
  };
}

function makeSlug(name) {
  return String(name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

module.exports = {
  ZONE,
  parseAutoStartInput,
  makeSlug,
};
