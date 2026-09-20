import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import Ladowanie from "../Ladowanie.jsx";
import { getAdminUserAudit, searchAdminUsers } from "../../lib/api.js";
import { useT } from "../../i18n/useLanguage.js";

// Wyszukiwarka graczy i audyt jednego gracza.
//
// PO CO, SKORO JEST PUBLICZNY PROFIL. Profil pokazuje punkty, miejsce,
// skuteczność, serie, rekordy i typy na fazy - i to wszystko zostaje tam.
// Ten panel dokłada dwie rzeczy, których tamten nie ma, a bez których audyt
// sprowadza się do grzebania w bazie:
//
//  1. KOMPLET typów. Na profilu historia jest ucięta do dziesięciu ostatnich
//     meczów; czołowy gracz Kolonii ma ich 106, czyli widać 9% jego wyborów.
//
//  2. Znalezienie człowieka bez wiedzy, w którym turnieju grał.
//
// Turniej wybiera się wyżej, w samym panelu - ten komponent dostaje gotowy
// slug i nie robi drugiego wybieraka na to samo.

/** Tyle czekamy po ostatnim znaku, zanim zapytamy serwer. */
const ODCZEKANIE_MS = 350;

function Wynik({ kto, punkty, opis }) {
  return (
    <div className="ui-stat">
      <span>{kto}</span>
      <strong>{punkty}</strong>
      {opis && <small>{opis}</small>}
    </div>
  );
}

/** Jeden mecz: typ, wynik, punkty i mapy. */
function WierszMeczu({ mecz, slug }) {
  const t = useT();

  // Kolor niesie trafienie, ale nie sam: obok stoi slowny stan, wiec wiersz
  // czyta sie tak samo bez rozrozniania barw.
  const klasa =
    mecz.correct_winner === true
      ? " audit-row--hit"
      : mecz.correct_winner === false
        ? " audit-row--miss"
        : "";

  return (
    <div className={`ui-card ui-card--flat ui-card--tight ui-stack ui-stack--tight audit-row${klasa}`}>
      <div className="ui-row ui-row--between ui-row--full ui-row--wrap">
        <div>
          <strong>
            {mecz.team_a} — {mecz.team_b}
          </strong>

          <p className="ui-stat__hint">
            #{mecz.match_no} · {mecz.phase} · BO{mecz.best_of} ·{" "}

            {/* Odnośnik przy opisie, a nie osobnym przyciskiem pod
                wierszem: przycisk na całą szerokość czytał się jak główna
                akcja audytu, a to jest tylko przejście do meczu. */}
            <Link to={`/events/${slug}/matches/${mecz.match_id}`}>
              #{mecz.match_id}
            </Link>
          </p>
        </div>

        <div className="ui-row ui-row--wrap audit-row__scores">
          <span className="ui-badge">
            {t("adminUsers.pick")}{" "}
            {mecz.picked ? `${mecz.pred_a}:${mecz.pred_b}` : t("adminUsers.noPick")}
          </span>

          <span className="ui-badge">
            {t("adminUsers.result")}{" "}
            {mecz.settled ? `${mecz.res_a}:${mecz.res_b}` : t("adminUsers.notSettled")}
          </span>

          <span
            className={`ui-badge ${mecz.points > 0 ? "ui-badge--accent" : ""}`}
          >
            {t("common.points", { count: mecz.points })}
          </span>
        </div>
      </div>

      {/* Mapy tylko tam, gdzie są - w BO1 ta linia nic by nie dodała.

          Mapa bez wyniku pokazuje sam typ: gracz mógł wpisać trzecią mapę
          w meczu, który skończył się po dwóch, i to nie jest jego błąd. */}
      {mecz.maps.length > 0 && (
        <div className="ui-row ui-row--wrap audit-maps">
          {mecz.maps.map((m) => (
            <span
              className={`ui-badge ${
                m.exact === true
                  ? "ui-badge--ok"
                  : m.correct_winner === false
                    ? "ui-badge--danger"
                    : ""
              }`}
              key={m.map_no}
            >
              {t("adminUsers.map", { no: m.map_no })}{" "}
              {m.pred_a === null ? "—" : `${m.pred_a}:${m.pred_b}`}
              {" / "}
              {m.res_a === null ? "—" : `${m.res_a}:${m.res_b}`}
            </span>
          ))}
        </div>
      )}

    </div>
  );
}

function UsersAdminPanel({ slug }) {
  const t = useT();

  const [wpisane, setWpisane] = useState("");
  const [szukane, setSzukane] = useState("");

  // Ta sama zasada, co przy wybranym graczu: pusta fraza NIE zeruje stanu
  // w efekcie, tylko przestaje go pokazywać. Zerowanie w efekcie wywołuje
  // kaskadę renderów.
  const [wynikiStan, setWyniki] = useState(null);
  const [szukaBladStan, setSzukaBlad] = useState("");

  const wyniki = szukane ? wynikiStan : null;
  const szukaBlad = szukane ? szukaBladStan : "";
  const [szukaTrwa, setSzukaTrwa] = useState(false);

  // Wybrany gracz trzymany RAZEM z turniejem, dla którego go wybrano.
  // Dzięki temu zmiana turnieju wyżej zamyka audyt sama, bez zerowania
  // stanu w efekcie - ten sam zabieg, co przy numerze strony w rankingu,
  // i z tego samego powodu: zerowanie w efekcie wywołuje kaskadę
  // renderów i jest błędem reguły set-state-in-effect.
  const [wybor, setWybor] = useState({ slug, gracz: null });

  const wybrany = wybor.slug === slug ? wybor.gracz : null;
  const [audytStan, setAudyt] = useState(null);

  const audyt = wybrany ? audytStan : null;
  const [audytBlad, setAudytBlad] = useState("");
  const [audytTrwa, setAudytTrwa] = useState(false);

  const [tylkoTypowane, setTylkoTypowane] = useState(false);

  // To, co wpisano, i to, czego szukamy, to dwie rozne rzeczy - bez
  // odczekania kazde nacisniecie klawisza byloby osobnym zapytaniem.
  // Ta sama wartosc co w rankingu.
  useEffect(() => {
    const licznik = setTimeout(() => setSzukane(wpisane.trim()), ODCZEKANIE_MS);

    return () => clearTimeout(licznik);
  }, [wpisane]);

  useEffect(() => {
    let anulowane = false;

    if (!szukane) return undefined;

    async function szukaj() {
      try {
        setSzukaTrwa(true);
        setSzukaBlad("");

        const dane = await searchAdminUsers(slug, szukane);

        if (!anulowane) setWyniki(dane);
      } catch (err) {
        if (!anulowane) setSzukaBlad(err.message || t("common.error"));
      } finally {
        if (!anulowane) setSzukaTrwa(false);
      }
    }

    szukaj();

    return () => {
      anulowane = true;
    };
  }, [slug, szukane, t]);

  const otworz = useCallback(
    async (gracz) => {
      setWybor({ slug, gracz });
      setAudyt(null);
      setAudytBlad("");
      setAudytTrwa(true);

      try {
        setAudyt(await getAdminUserAudit(slug, gracz.user_id));
      } catch (err) {
        setAudytBlad(err.message || t("common.error"));
      } finally {
        setAudytTrwa(false);
      }
    },
    [slug, t],
  );

  if (wybrany) {
    const s = audyt?.summary;

    const wiersze = (audyt?.rows ?? []).filter(
      (w) => !tylkoTypowane || w.picked,
    );

    return (
      <div className="ui-stack">
        <div className="ui-row ui-row--between ui-row--wrap ui-row--full">
          <button
            type="button"
            className="ui-btn ui-btn--ghost ui-btn--sm"
            onClick={() => setWybor({ slug, gracz: null })}
          >
            {t("adminUsers.backToSearch")}
          </button>

          <Link
            className="ui-btn ui-btn--ghost ui-btn--sm"
            to={`/events/${slug}/player/${wybrany.user_id}`}
          >
            {t("adminUsers.profileLink")}
          </Link>
        </div>

        <div>
          <h3>{wybrany.displayname || wybrany.user_id}</h3>

          <p className="ui-stat__hint">
            {wybrany.username && wybrany.username !== wybrany.displayname
              ? `${wybrany.username} · `
              : ""}
            {wybrany.user_id}
          </p>
        </div>

        {audytTrwa && <Ladowanie />}

        {audytBlad && (
          <div className="ui-error" role="alert">
            <p className="ui-error__text">{audytBlad}</p>
          </div>
        )}

        {s && (
          <>
            <div className="ui-stats ui-stats--4">
              <Wynik
                kto={t("adminUsers.sum.points")}
                punkty={s.points}
                opis={null}
              />

              <Wynik
                kto={t("adminUsers.sum.picked")}
                punkty={s.picked}
                opis={t("adminUsers.sum.ofAll", { count: s.matches })}
              />

              <Wynik
                kto={t("adminUsers.sum.correct")}
                punkty={s.correct}
                opis={t("adminUsers.sum.ofSettled", { count: s.settled })}
              />

              <Wynik
                kto={t("adminUsers.sum.accuracy")}
                punkty={s.accuracy === null ? "—" : `${s.accuracy}%`}
                opis={null}
              />
            </div>

            {s.matches === 0 ? (
              <p className="ui-note">{t("adminUsers.emptyEvent")}</p>
            ) : (
              <>
                <div className="ui-section-head">
                  <div>
                    <h3>{t("adminUsers.table.title")}</h3>

                    <p>{t("adminUsers.table.lead")}</p>
                  </div>

                  <label className="ui-row ui-row--wrap">
                    <input
                      type="checkbox"
                      checked={tylkoTypowane}
                      onChange={(e) => setTylkoTypowane(e.target.checked)}
                    />

                    <span>{t("adminUsers.onlyPicked")}</span>
                  </label>
                </div>

                <div className="ui-stack ui-stack--tight">
                  {wiersze.map((mecz) => (
                    <WierszMeczu key={mecz.match_id} mecz={mecz} slug={slug} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="ui-stack">
      <div>
        <input
          type="search"
          value={wpisane}
          onChange={(e) => setWpisane(e.target.value)}
          placeholder={t("adminUsers.search")}
          aria-label={t("adminUsers.searchLabel")}
        />

        <p className="ui-stat__hint">
          {t("adminUsers.searchHint", { count: wyniki?.minZnakow ?? 2 })}
        </p>
      </div>

      {szukaTrwa && <Ladowanie />}

      {szukaBlad && (
        <div className="ui-error" role="alert">
          <p className="ui-error__text">{szukaBlad}</p>
        </div>
      )}

      {wyniki && wyniki.users.length === 0 && (
        <p className="ui-note">{t("adminUsers.nobody")}</p>
      )}

      {wyniki && wyniki.users.length > 0 && (
        <>
          <p className="ui-stat__hint">
            {t("adminUsers.found", { count: wyniki.znalezionych })}
          </p>

          <div className="ui-stack ui-stack--tight">
            {wyniki.users.map((gracz) => (
              <button
                type="button"
                className="ui-card ui-card--interactive ui-card--tight ui-row ui-row--between ui-row--full"
                key={gracz.user_id}
                onClick={() => otworz(gracz)}
              >
                <span>
                  <strong>{gracz.displayname || gracz.user_id}</strong>

                  <small className="ui-stat__hint">
                    {gracz.username && gracz.username !== gracz.displayname
                      ? `${gracz.username} · `
                      : ""}
                    {gracz.user_id}
                  </small>
                </span>

                <span aria-hidden="true">→</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default UsersAdminPanel;
