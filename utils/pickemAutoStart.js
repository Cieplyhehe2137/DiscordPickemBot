const { DateTime } = require('luxon');

const ZONE = 'Europe/Warsaw';

function parseAutoStartInput(rawInput) { 
    const ds = DateTime.fromFormat(
        String(rawInput || '').trim(),
        'yyyy-MM-dd HH:mm',
        {
            zone: ZONE
        }
    );

    if (!dt.isValid) {
        return {
            ok: false,
            error:
                'Niepoprawny format. Użyj YYYY-MM-DD HH:mm, np. 2026-08-15 18:00.'
        };
    }

    return {
        ok: true,
        local: dt,
        utc: dt.toUTC(),
        utcDate: dt.toUTC().toJSDate(),
        utcSql: dt.toUTC().toFormat('yyyy-LL-dd HH:mm:ss')
    };
}

function makeSlug(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

module.exports = {
    ZONE,
    parseAutoStartInput,
    makeSlug
};