import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { getAllEvents } from "../lib/api.js";
import { odmien } from "../lib/odmiana.js";
import { humanPhase } from "../lib/phaseLabels.js";

function EventCard({ event }) {
  const live = Boolean(event.is_live);

  return (
    <Link
      className="ui-card ui-card--interactive ui-tile"
      to={`/events/${event.slug}`}
    >
      <div className="ui-row ui-row--between ui-row--full">
        <span className={`ui-badge ${live ? "ui-badge--live" : ""}`}>
          {live ? "Trwa" : "Zakończony"}
        </span>

        <span className="ui-stat__hint">{humanPhase(event.phase)}</span>
      </div>

      <strong className="ui-tile__name">{event.name}</strong>

      <div className="ui-row ui-row--wrap ui-tile__meta">
        {event.participants > 0 && (
          <span className="ui-badge">
            {event.participants}{" "}
            {odmien(event.participants, "gracz", "gracze", "graczy")}
          </span>
        )}

        {event.matches_count > 0 && (
          <span className="ui-badge">
            {event.matches_count}{" "}
            {odmien(event.matches_count, "mecz", "mecze", "meczów")}
          </span>
        )}
      </div>
    </Link>
  );
}

function EventsPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadEvents() {
      try {
        // getAllEvents zamiast getActiveEvents: /events/active odfiltrowuje
        // wszystko poza trwającym turniejem, więc zakończone Pick'Emy nie
        // miały z UI żadnego wejścia, mimo że ich podstrony działają.
        const data = await getAllEvents();

        setEvents(data.events ?? []);
      } catch (err) {
        console.error("EVENTS ERROR:", err);

        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadEvents();
  }, []);

  const aktywne = events.filter((event) => event.is_live);
  const zakonczone = events.filter((event) => !event.is_live);

  return (
    <main className="ui-page">
      <div className="ui-section-head">
        <div>
          <span className="ui-kicker">Turnieje</span>

          <h2>Eventy</h2>

          <p>
            Wybierz turniej, żeby przejść do typowania meczów, faz turnieju i
            rankingu. Zakończone Pick&apos;Emy zostają dostępne do przeglądania.
          </p>
        </div>
      </div>

      {loading && (
        <div className="ui-tiles" aria-busy="true" aria-label="Ładowanie turniejów">
          {Array.from({ length: 3 }, (_, i) => (
            <div className="ui-skeleton ui-skeleton--row" key={i} />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="ui-error" role="alert">
          <span className="ui-error__icon" aria-hidden="true">
            ⚠️
          </span>

          <strong className="ui-error__title">
            Nie udało się pobrać turniejów
          </strong>

          <p className="ui-error__text">{error}</p>
        </div>
      )}

      {!loading && !error && events.length === 0 && (
        <div className="ui-empty">
          <span className="ui-empty__icon" aria-hidden="true">
            🏆
          </span>

          <strong className="ui-empty__title">Nie ma jeszcze turniejów</strong>

          <p className="ui-empty__text">
            Gdy pierwszy Pick&apos;Em wystartuje, pojawi się na tej liście.
          </p>
        </div>
      )}

      {!loading && !error && aktywne.length > 0 && (
        <section className="ui-stack ui-stack--loose">
          <div className="ui-section-head">
            <div>
              <span className="ui-kicker">Teraz</span>
              <h2>Trwające</h2>
            </div>
          </div>

          <div className="ui-tiles">
            {aktywne.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </section>
      )}

      {!loading && !error && zakonczone.length > 0 && (
        <section className="ui-stack ui-stack--loose">
          <div className="ui-section-head">
            <div>
              <span className="ui-kicker">Archiwum</span>
              <h2>Zakończone</h2>

              {/* Informacja zamiast osobnej karty "brak aktywnego turnieju" -
                  pusta karta w siatce wyglądała jak zepsuty kafelek. */}
              {aktywne.length === 0 && (
                <p>
                  Aktualnie nie trwa żaden Pick&apos;Em. Poniżej turnieje, które
                  możesz przeglądać.
                </p>
              )}
            </div>
          </div>

          <div className="ui-tiles">
            {zakonczone.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

export default EventsPage;
