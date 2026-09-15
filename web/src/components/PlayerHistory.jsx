import { Link } from "react-router-dom";

import { odmien } from "../lib/odmiana.js";

// Starty gracza w pozostałych turniejach.
//
// Profil jest w tym serwisie zawsze w obrębie jednego eventu i do tej pory
// nie dało się nigdzie zobaczyć, że ktoś grał w kilku.
//
// Sekcja nie pojawia się dla 85% graczy - tylu zagrało w dokładnie jednym
// turnieju. To nie jest stan pusty do zagospodarowania, tylko przypadek
// normalny: nie ma czego pokazać, więc nie ma sekcji.

function PlayerHistory({ events, userId }) {
  if (!events?.length) return null;

  return (
    <section className="ui-card ui-stack">
      <div className="ui-section-head">
        <div>
          <span className="ui-kicker">Poza tym turniejem</span>

          <h2>Grał też w</h2>

          <p>
            {events.length}{" "}
            {odmien(events.length, "inny turniej", "inne turnieje", "innych turniejów")}
            {" — kliknij, żeby zobaczyć tamten profil."}
          </p>
        </div>
      </div>

      <div className="ui-stack ui-stack--tight">
        {events.map((e) => (
          <Link
            className="history-row"
            key={e.event_id}
            to={`/events/${e.slug}/player/${userId}`}
          >
            <div className="history-row__main">
              <strong className="history-row__name">{e.name}</strong>

              <span className="ui-stat__hint">
                {e.rank === null ? (
                  "niesklasyfikowany"
                ) : (
                  <>
                    miejsce {e.rank} z {e.participants}
                    {e.top_percent !== null && ` · TOP ${e.top_percent}%`}
                  </>
                )}
              </span>
            </div>

            <strong className="history-row__points">{e.points} pkt</strong>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default PlayerHistory;
