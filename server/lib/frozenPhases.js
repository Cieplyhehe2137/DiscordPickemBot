// Ktore fazy typowania druzyn sa juz zamrozone dla eventu.
//
// Powody sa stalymi, a nie literalami w kodzie, bo trafiaja do odpowiedzi API
// i na ekran - test ma sie o nie opierac, a nie przepisywac ich tekst.

export const FROZEN_EVENT_OVER = "event zakończony";
export const FROZEN_HAS_PICKS = "są już typy lub wynik";

// Zaleznosci argumentem: pula, lista faz z konfiguracji i normalizePhase.
// Dzieki temu regule da sie sprawdzic z atrapa puli, bez bazy.
export function createFrozenPhases({ pool, phases, normalizePhase }) {
  // Które fazy typowania drużyn są już zamrożone dla danego eventu.
  //
  // Limity fazy wolno zmieniać tylko dopóki nikt nie oddał w niej typu i nie ma
  // wpisanego wyniku. Później zapisane typy były sprawdzane wobec INNYCH liczb -
  // zmiana limitu nie unieważnia ich ani nie przelicza, tylko sprawia, że turniej
  // przestaje się zgadzać sam ze sobą, a strony faz pokazują historię, której
  // nigdy nie było.
  //
  // Zakończony lub zarchiwizowany event jest zamrożony w całości, także w fazach,
  // w których nikt nie typował - inaczej dałoby się zmienić opis formatu
  // rozegranego turnieju.
  async function getFrozenPhases(eventId) {
    const [[event]] = await pool.query(
      "SELECT status, is_archived FROM events WHERE id = ? LIMIT 1",
      [eventId],
    );

    const eventOver =
      String(event?.status || "").toUpperCase() === "FINISHED" ||
      Number(event?.is_archived) === 1;

    if (eventOver) {
      return Object.fromEntries(
        phases.map((phase) => [phase, FROZEN_EVENT_OVER]),
      );
    }

    const [[swissStages], [others]] = await Promise.all([
      pool
        .query(
          `
          SELECT DISTINCT stage FROM swiss_predictions
           WHERE event_id = ? AND stage IS NOT NULL
          UNION
          SELECT DISTINCT stage FROM swiss_results
           WHERE event_id = ? AND stage IS NOT NULL
          `,
          [eventId, eventId],
        )
        .then(([rows]) => [rows]),
      pool
        .query(
          `
          SELECT
            (SELECT COUNT(*) FROM playoffs_predictions WHERE event_id = ?)
          + (SELECT COUNT(*) FROM playoffs_results     WHERE event_id = ?) AS playoffs,
            (SELECT COUNT(*) FROM playin_predictions   WHERE event_id = ?)
          + (SELECT COUNT(*) FROM playin_results       WHERE event_id = ?) AS playin,
            (SELECT COUNT(*) FROM doubleelim_predictions WHERE event_id = ?)
          + (SELECT COUNT(*) FROM doubleelim_results     WHERE event_id = ?) AS doubleelim
          `,
          [eventId, eventId, eventId, eventId, eventId, eventId],
        )
        .then(([rows]) => [rows[0]]),
    ]);

    const frozen = {};

    // normalizePhase() zwraca 'SWISS_STAGE1', a konfiguracja kluczuje po
    // 'stage1' - bez tego przełożenia żaden etap Swiss nigdy by nie trafił.
    const STAGE_KEY = {
      SWISS_STAGE1: "stage1",
      SWISS_STAGE2: "stage2",
      SWISS_STAGE3: "stage3",
    };

    for (const row of swissStages || []) {
      const phase = STAGE_KEY[normalizePhase(row.stage)];

      if (phase) {
        frozen[phase] = FROZEN_HAS_PICKS;
      }
    }

    for (const phase of ["playoffs", "playin", "doubleelim"]) {
      if (Number(others?.[phase] || 0) > 0) {
        frozen[phase] = FROZEN_HAS_PICKS;
      }
    }

    return frozen;
  }

  return { getFrozenPhases };
}
