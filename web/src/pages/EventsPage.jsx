import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { getAllEvents } from "../lib/api.js";
import { humanPhase } from "../lib/phaseLabels.js";

function EventCard({ event }) {
  return (
    <article className="event-card" key={event.id}>
      <div className="event-card__top">
        <span
          className={
            event.is_live ? "event-status" : "event-status event-status--done"
          }
        >
          {event.is_live ? "AKTYWNY" : "ZAKOŃCZONY"}
        </span>

        <span className="event-type">CS2</span>
      </div>

      <h2>{event.name}</h2>

      <p className="event-card__meta">
        {humanPhase(event.phase)}
        {event.matches_count > 0 && ` · ${event.matches_count} meczów`}
        {event.participants > 0 && ` · ${event.participants} graczy`}
      </p>

      <p>
        {event.is_live
          ? "Przejdź do eventu i sprawdź dostępne typy, mecze oraz ranking."
          : "Turniej zakończony — mecze, wyniki, ranking końcowy i Twoje typy."}
      </p>

      <Link className="event-card__button" to={`/events/${event.slug}`}>
        {event.is_live ? "Otwórz event" : "Zobacz wyniki"}
      </Link>
    </article>
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
    <main className="events-page">
      <section className="events-hero">
        <span className="events-kicker">Turnieje</span>

        <h1>Eventy</h1>

        <p>
          Wybierz turniej, żeby przejść do typowania meczów, faz turnieju i
          rankingu. Zakończone Pick'Emy zostają dostępne do przeglądania.
        </p>
      </section>

      {loading && (
        <section className="events-grid">
          <article className="event-card">
            <h2>Ładowanie...</h2>

            <p>Pobieram listę turniejów.</p>
          </article>
        </section>
      )}

      {!loading && error && (
        <section className="events-grid">
          <article className="event-card">
            <h2>Nie udało się pobrać turniejów</h2>

            <p>{error}</p>
          </article>
        </section>
      )}

      {!loading && !error && events.length === 0 && (
        <section className="events-grid">
          <article className="event-card">
            <h2>Brak turniejów</h2>

            <p>Nie ma jeszcze żadnego Pick'Ema.</p>
          </article>
        </section>
      )}

      {!loading && !error && aktywne.length > 0 && (
        <>
          <h2 className="events-section-title">Trwające</h2>

          <section className="events-grid">
            {aktywne.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </section>
        </>
      )}

      {!loading && !error && aktywne.length === 0 && events.length > 0 && (
        <section className="events-grid">
          <article className="event-card">
            <h2>Brak aktywnego turnieju</h2>

            <p>
              Aktualnie nie trwa żaden Pick'Em. Poniżej znajdziesz zakończone
              turnieje.
            </p>
          </article>
        </section>
      )}

      {!loading && !error && zakonczone.length > 0 && (
        <>
          <h2 className="events-section-title">Zakończone</h2>

          <section className="events-grid">
            {zakonczone.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </section>
        </>
      )}
    </main>
  );
}

export default EventsPage;
