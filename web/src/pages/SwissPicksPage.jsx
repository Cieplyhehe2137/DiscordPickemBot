import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import BackLink from "../components/BackLink.jsx";
import Ladowanie from "../components/Ladowanie.jsx";
import TeamCrest from "../components/TeamCrest.jsx";
import { getEventSwissPicks } from "../lib/api.js";
import { humanPhase } from "../lib/phaseLabels.js";
import { useT } from "../i18n/useLanguage.js";

// Typy na fazy Swiss zestawione z tym, co naprawdę się stało.
//
// Statystyki drużyn w tym serwisie liczą WYŁĄCZNIE mecze - mówi to wprost
// komentarz w server/lib/teamStats.js. To jest druga połowa: 2 074 wiersze
// faz dają po rozbiciu 18 803 oceny drużyn, wobec 10 328 typów meczowych.
//
// DLACZEGO OSOBNA STRONA, a nie sekcja na stronie turnieju: trzy etapy
// razy trzy grupy razy kilka drużyn to kilkadziesiąt wierszy. Na stronie
// turnieju przykryłoby to wszystko inne.

// Klucz słownika dla każdej grupy. Nazwy stoją tu dosłownie, bo sklejanie
// `swissPicks.group.${kind}` ukryłoby je przed wyszukiwaniem w kodzie -
// a kind przychodzi z serwera, więc literówka po tamtej stronie dałaby
// pusty nagłówek zamiast błędu.
const KLUCZ_GRUPY = {
  three_zero: "swissPicks.group.threeZero",
  zero_three: "swissPicks.group.zeroThree",
  advancing: "swissPicks.group.advancing",
};

function Grupa({ grupa }) {
  const t = useT();

  const klucz = KLUCZ_GRUPY[grupa.kind];

  if (!klucz) return null;

  return (
    <div className="swiss-group">
      <h3 className="swiss-group__title">{t(klucz)}</h3>

      <div className="swiss-group__teams">
        {grupa.teams.map((druzyna) => (
          <div
            className={`swiss-team${druzyna.correct ? " swiss-team--correct" : ""}`}
            key={druzyna.name}
          >
            <TeamCrest name={druzyna.name} logo={druzyna.logo} />

            <span className="swiss-team__name">{druzyna.name}</span>

            {/* Plakietka, a nie sam kolor paska. Zielony pasek mówi to samo,
                ale kolor nie może być JEDYNYM nośnikiem znaczenia - przy
                daltonizmie zostaje wtedy sama długość, która mierzy procent,
                a nie trafność. */}
            {druzyna.correct && (
              <span className="ui-badge ui-badge--ok">
                {t("swissPicks.correct")}
              </span>
            )}

            <div className="ui-meter">
              <div
                className={`ui-meter__fill${
                  druzyna.correct ? " ui-meter__fill--ok" : ""
                }`}
                style={{ width: `${druzyna.percent}%` }}
              />
            </div>

            <span className="swiss-team__share">
              {t("common.percentValue", { percent: druzyna.percent })}
            </span>
          </div>
        ))}
      </div>

      <div className="swiss-group__foot">
        {/* Etykieta i wartość osobno, bez zdania - nazwy drużyn to wolny
            tekst z bazy i nie da się ich odmienić. */}
        {grupa.overrated && (
          <span className="swiss-group__note">
            {t("swissPicks.overrated")}:{" "}
            <strong>{grupa.overrated.name}</strong>{" "}
            {t("common.percentValue", { percent: grupa.overrated.percent })}
          </span>
        )}

        {grupa.missed > 0 && (
          <span className="ui-badge ui-badge--warn">
            {t("swissPicks.missed", { count: grupa.missed })}
          </span>
        )}
      </div>
    </div>
  );
}

function SwissPicksPage() {
  const t = useT();

  const { slug } = useParams();

  const [dane, setDane] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let aktualne = true;

    async function wczytaj() {
      try {
        setLoading(true);
        setError("");

        const odpowiedz = await getEventSwissPicks(slug);

        if (aktualne) setDane(odpowiedz);
      } catch (err) {
        if (aktualne) setError(err.message || t("swissPicks.errorText"));
      } finally {
        if (aktualne) setLoading(false);
      }
    }

    wczytaj();

    return () => {
      aktualne = false;
    };
  }, [slug, t]);

  if (loading) {
    return (
      <main className="ui-page">
        <Ladowanie>{t("swissPicks.loading")}</Ladowanie>
      </main>
    );
  }

  if (error) {
    return (
      <main className="ui-page">
        <BackLink to={`/events/${slug}`}>{t("swissPicks.back")}</BackLink>

        <p className="ui-note ui-note--danger">{t("swissPicks.errorText")}</p>
      </main>
    );
  }

  const etapy = dane?.stages ?? [];

  return (
    <main className="ui-page">
      <BackLink to={`/events/${slug}`}>{t("swissPicks.back")}</BackLink>

      <div className="ui-section-head">
        <div>
          <span className="ui-kicker">{t("swissPicks.kicker")}</span>

          <h2>{dane?.event?.name ?? t("swissPicks.title")}</h2>

          <p>{t("swissPicks.intro")}</p>
        </div>
      </div>

      {/* Nie każdy format ma Swiss - IEM Kraków 2026 miał play-in i double
          elim. Pusty stan jest tu poprawną odpowiedzią, nie awarią. */}
      {etapy.length === 0 ? (
        <div className="ui-empty">
          <span className="ui-empty__icon" aria-hidden="true">
            🇨🇭
          </span>

          <strong className="ui-empty__title">
            {t("swissPicks.empty.title")}
          </strong>

          <p className="ui-empty__text">{t("swissPicks.empty.text")}</p>
        </div>
      ) : (
        <>
          {etapy.map((etap) => (
            <section className="ui-card ui-stack" key={etap.stage}>
              <div className="ui-section-head">
                <div>
                  <span className="ui-kicker">{humanPhase(etap.stage, t)}</span>

                  <h2>{t("swissPicks.total", { count: etap.total })}</h2>

                  {!etap.settled && <p>{t("swissPicks.pending")}</p>}
                </div>
              </div>

              <div className="swiss-groups">
                {etap.groups.map((grupa) => (
                  <Grupa grupa={grupa} key={grupa.kind} />
                ))}
              </div>
            </section>
          ))}

          <p className="ui-note">
            {t("swissPicks.note", { count: dane.missed_below })}
          </p>
        </>
      )}
    </main>
  );
}

export default SwissPicksPage;
