// Rywale gracza w turnieju jako publiczne API.
//
// Po co ta trasa istnieje, stoi w server/lib/rivals.js. Tutaj jest wyłącznie
// pobranie danych - cała reguła siedzi w funkcji czystej obok.
//
// OSOBNA TRASA, A NIE KOLEJNE ZAPYTANIE W PROFILU. Profil gracza robi dziś
// piętnaście zapytań w jednej fali i oddaje odpowiedź po jednej podróży do
// bazy. Zmierzone: wiersze potrzebne do rywali liczą się 247 ms (mediana
// z pięciu prób, IEM Cologne, 6424 wiersze) - doklejone do tamtej fali
// opóźniłyby CAŁY profil o te 70 ms ponad podróż, dla sekcji na jego końcu.
// Osobna trasa leci z przeglądarki równolegle, więc profil zjawia się kiedy
// dotąd, a rywale dochodzą, gdy są gotowi.
//
// ADRES MA CZTERY SEGMENTY po /api/public/, więc nie ma mowy o wpadnięciu
// w /api/public/:guildSlug. Test i tak tego pilnuje - patrz uwaga w
// server/routes/playerCareer.js, gdzie stoi ten sam powód.

import { buildRivals } from "../lib/rivals.js";
import { createLeaderboardCache } from "../lib/leaderboardCache.js";
import { SQL_NAZWY } from "./upsets.js";

const SQL_EVENT = `
    SELECT id, name, slug
    FROM events
    WHERE slug = ?
    LIMIT 1
`;

// Punkty każdego gracza za każdy ROZSTRZYGNIĘTY mecz turnieju, po jednym
// wierszu na parę gracz-mecz.
//
// DLACZEGO PRZEZ match_predictions, A NIE PROSTO Z match_points: bo
// match_points ma wiersze, którym nie odpowiada żaden typ. Zmierzone na
// IEM Cologne - par w match_points 6425, par z typów na mecze rozstrzygnięte
// 6424. Ta jedna nadmiarowa wystarczyłaby, żeby wymyślić rywalizację
// z meczu, którego ktoś nie obstawił.
//
// SUM, bo match_points trzyma osobno punkty za serię i za mapy. Bez
// zsumowania na mecz każdy mecz liczyłby się dwa razy, a porównanie
// odbywałoby się między połówkami wyniku.
//
// INNER JOIN z wynikami odsiewa mecze nierozegrane: tam obaj mają zero,
// co wyglądałoby na remis, a jest brakiem rozstrzygnięcia.
const SQL_PUNKTY = `
    SELECT
        CAST(mp.user_id AS CHAR CHARACTER SET utf8mb4)
          COLLATE utf8mb4_unicode_ci AS user_id,

        mp.match_id,

        COALESCE(SUM(pts.points), 0) AS points

    FROM match_predictions mp

    INNER JOIN match_results mr
        ON mr.event_id = mp.event_id
       AND mr.match_id = mp.match_id

    LEFT JOIN match_points pts
        ON pts.event_id = mp.event_id
       AND pts.match_id = mp.match_id
       AND pts.user_id  = mp.user_id

    WHERE mp.event_id = (SELECT id FROM events WHERE slug = ? LIMIT 1)

    GROUP BY mp.user_id, mp.match_id
`;

const SQL_PROFILE = `
    SELECT
        CAST(user_id AS CHAR CHARACTER SET utf8mb4)
          COLLATE utf8mb4_unicode_ci AS user_id,

        displayname,
        avatar

    FROM user_profiles
`;

export function registerRivalsRoutes(app, { pool }) {
  // Pamięć podręczna trzyma to, co NIE zależy od gracza: wiersze turnieju
  // i nazwy. Bilans liczy się z nich w JS w jednej milisekundzie (zmierzone
  // dla gracza z 306 meczami), więc jeden wpis obsługuje profile wszystkich
  // graczy tego turnieju, a nie jeden profil.
  const cache = createLeaderboardCache({
    load: async (slug) => {
      const [[[event]], [punkty], [profile], [nazwy]] = await Promise.all([
        pool.query(SQL_EVENT, [slug]),
        pool.query(SQL_PUNKTY, [slug]),
        pool.query(SQL_PROFILE),
        pool.query(SQL_NAZWY),
      ]);

      return {
        event: event ?? null,

        punkty,

        // Profile PRZED nazwami z faz - ta sama kolejność i ten sam powód,
        // co na stronie niespodzianek: pierwszy wpis o graczu wygrywa,
        // a profil niesie awatar i jest odświeżany przy każdym logowaniu.
        profiles: [...profile, ...nazwy],
      };
    },
  });

  app.get(
    "/api/public/events/:slug/players/:userId/rivals",
    async (req, res) => {
      try {
        const { slug, userId } = req.params;

        const dane = await cache.get(slug);

        if (!dane.event) {
          return res.status(404).json({
            error: "Nie znaleziono turnieju.",
            code: "server.eventNotFound",
          });
        }

        const wynik = buildRivals(dane.punkty, userId, {
          profiles: dane.profiles,
        });

        return res.json({
          event: {
            id: dane.event.id,
            name: dane.event.name,
            slug: dane.event.slug,
          },

          user_id: String(userId),

          // min_decided przyjeżdża z wyniku, a nie z tej trasy: próg należy
          // do reguły, a dwie kopie tej samej liczby rozjeżdżają się wtedy,
          // gdy ktoś poprawi jedną.
          ...wynik,
        });
      } catch (err) {
        console.error("RIVALS ERROR:", err);

        return res.status(500).json({
          error: "Nie udało się wczytać rywali.",
          code: "server.rivalsFailed",
        });
      }
    },
  );
}
