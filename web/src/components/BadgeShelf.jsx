import { awardBadges, POZIOM_KLASA } from "../lib/badges.js";
import { odmien } from "../lib/odmiana.js";

// Odznaki gracza: zdobyte i te w zasięgu.
//
// Sekcja „blisko" nie jest ozdobą - to jedyny element profilu, który mówi,
// co jeszcze można zrobić. Bez niej odznaki są podsumowaniem przeszłości
// i nie ma powodu tu wracać.
//
// Sprawdzone na trzydziestu prawdziwych profilach z całej stawki: czołówka
// zbiera 6-8 odznak, środek 4-6, koniec stawki 0-2. Najrzadsza przypada
// trzem procentom graczy, najczęstsza dwóm trzecim - czyli żadna nie jest
// ani powszechna, ani nieosiągalna.

function Odznaka({ odznaka }) {
  return (
    <div
      className={`badge-tile ${POZIOM_KLASA[odznaka.tier]}`}
      title={odznaka.desc}
    >
      <span className="badge-tile__icon" aria-hidden="true">
        {odznaka.icon}
      </span>

      <span className="badge-tile__body">
        <strong className="badge-tile__label">{odznaka.label}</strong>

        <small className="badge-tile__desc">{odznaka.desc}</small>
      </span>
    </div>
  );
}

function Blisko({ odznaka }) {
  return (
    <div className="badge-next">
      <span className="badge-next__icon" aria-hidden="true">
        {odznaka.icon}
      </span>

      <div className="badge-next__body">
        <div className="ui-row ui-row--between ui-row--full">
          <strong className="badge-next__label">{odznaka.label}</strong>

          <span className="ui-stat__hint">
            {odznaka.value} / {odznaka.target}
            {odznaka.unit}
          </span>
        </div>

        <div className="ui-meter">
          <div
            className="ui-meter__fill"
            style={{ width: `${odznaka.percent}%` }}
          />
        </div>

        <small className="badge-next__desc">{odznaka.desc}</small>
      </div>
    </div>
  );
}

function BadgeShelf({ profile }) {
  const { earned, next } = awardBadges(profile);

  return (
    <section className="ui-card ui-stack">
      <div className="ui-section-head">
        <div>
          <span className="ui-kicker">Odznaki</span>

          <h2>Osiągnięcia w tym turnieju</h2>

          {earned.length > 0 && (
            <p>
              {earned.length}{" "}
              {odmien(
                earned.length,
                "odznaka zdobyta",
                "odznaki zdobyte",
                "odznak zdobytych",
              )}
            </p>
          )}
        </div>
      </div>

      {earned.length === 0 ? (
        <div className="ui-empty">
          <span className="ui-empty__icon" aria-hidden="true">
            🎖️
          </span>

          <strong className="ui-empty__title">Jeszcze żadnej odznaki</strong>

          <p className="ui-empty__text">
            Pojawią się po pierwszych rozliczonych meczach — niżej widać, co
            jest najbliżej.
          </p>
        </div>
      ) : (
        <div className="badge-grid">
          {earned.map((odznaka) => (
            <Odznaka key={odznaka.key} odznaka={odznaka} />
          ))}
        </div>
      )}

      {next.length > 0 && (
        <div className="ui-stack ui-stack--tight">
          <span className="ui-stat__hint">W zasięgu</span>

          {next.map((odznaka) => (
            <Blisko key={odznaka.key} odznaka={odznaka} />
          ))}
        </div>
      )}
    </section>
  );
}

export default BadgeShelf;
