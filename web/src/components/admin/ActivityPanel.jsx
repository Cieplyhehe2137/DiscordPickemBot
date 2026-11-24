import { useCallback, useEffect, useRef, useState } from "react";

import Ladowanie from "../../components/Ladowanie.jsx";
import { getGuildActivity } from "../../lib/api.js";
import { useT } from "../../i18n/useLanguage.js";

// Co się ostatnio działo na serwerze: kto oddał typ, kto wpisał wynik.
//
// SKĄD TO WIE. Z znaczników czasu w bazie, nie ze zdarzeń socket.io. Typy
// powstają w DWÓCH niezależnych procesach - bot pisze prosto do bazy, a API
// ma własne trasy zapisu - więc zdarzenie wypychane przy zapisie pokazałoby
// tylko to, co wpadło przez stronę, a przegapiło wszystko z Discorda, czyli
// większość. Odczyt z bazy nie zależy od tego, kto pisał.
//
// ODŚWIEŻA SIĘ SAMO, dopóki panel jest otwarty. Interwał czyści się przy
// zamknięciu sekcji - bez tego zapytania lecą dalej po wyjściu z zakładki.
//
// CZEGO TU NIE BĘDZIE: typów z turniejów wgranych importem. iem-cologne
// i starladder-budapest mają puste submitted_at we WSZYSTKICH wierszach faz,
// a ich typy meczowe niosą 15 różnych znaczników na 6424 wiersze - jeden
// moment wgrania, nie historia typowania. Wiersza bez czasu nie da się
// postawić na osi, więc nie udajemy, że się da.

const ODSWIEZANIE_MS = 30000;

const IKONY = {
  matchPick: "🎯",
  swissPick: "📋",
  playinPick: "🚪",
  playoffsPick: "🏆",
  doubleelimPick: "⚔️",
  mvpPick: "⭐",
  matchResult: "🏁",
};

/** "przed chwilą", "8 min temu" - pełna godzina zostaje w tooltipie. */
function kiedy(t, iso) {
  const ms = Date.parse(iso);

  if (!Number.isFinite(ms)) return "";

  const sekund = Math.max(0, Math.round((Date.now() - ms) / 1000));

  if (sekund < 60) return t("adminPage.activity.justNow");

  const minut = Math.round(sekund / 60);

  if (minut < 60) return t("adminPage.activity.minutesAgo", { count: minut });

  const godzin = Math.round(minut / 60);

  if (godzin < 24) return t("adminPage.activity.hoursAgo", { count: godzin });

  return t("adminPage.activity.daysAgo", { count: Math.round(godzin / 24) });
}

function ActivityPanel({ guildId }) {
  const t = useT();

  const [dane, setDane] = useState(null);
  const [zaladowane, setZaladowane] = useState(false);
  const [blad, setBlad] = useState("");
  const [odswiezam, setOdswiezam] = useState(false);

  // Ref, nie stan: timer nie może restartować efektu, który sam ustawia.
  const zywy = useRef(true);

  const pobierz = useCallback(
    async (cicho = false) => {
      if (!cicho) setOdswiezam(true);

      try {
        const d = await getGuildActivity(guildId, 60);

        if (!zywy.current) return;

        setDane(d);
        setBlad("");
      } catch (err) {
        console.error("ACTIVITY LOAD:", err);

        if (zywy.current) setBlad(err.message || t("adminPage.activity.loadError"));
      } finally {
        if (zywy.current) {
          setZaladowane(true);
          setOdswiezam(false);
        }
      }
    },
    [guildId, t],
  );

  useEffect(() => {
    zywy.current = true;

    // Pierwsze pobranie przez setTimeout(0), a nie wprost: wywołane
    // synchronicznie w efekcie ustawiałoby stan w trakcie renderowania
    // i react-hooks słusznie to wytyka jako kaskadę renderów.
    const pierwsze = setTimeout(() => pobierz(true), 0);

    const id = setInterval(() => pobierz(true), ODSWIEZANIE_MS);

    return () => {
      zywy.current = false;

      clearTimeout(pierwsze);
      clearInterval(id);
    };
  }, [pobierz]);

  if (!zaladowane) {
    return <Ladowanie>{t("adminPage.activity.loading")}</Ladowanie>;
  }

  if (blad) return <p className="ui-note ui-note--danger">{blad}</p>;

  const items = dane?.items ?? [];

  return (
    <div className="ui-stack">
      <p className="ui-hint">{t("adminPage.activity.hint")}</p>

      {/* Turniej wgrany importem ma setki wierszy z jednym znacznikiem -
          gdyby trafił na listę, wyglądałby jak nagły wysyp typowania. */}
      {dane?.importLooking && (
        <p className="ui-note ui-note--warn">
          {t("adminPage.activity.importWarning")}
        </p>
      )}

      {items.length === 0 ? (
        <p className="ui-note">{t("adminPage.activity.empty")}</p>
      ) : (
        <>
          <div className="ui-stack ui-stack--tight">
            {items.map((z, i) => {
              const kto =
                z.displayname ||
                z.username ||
                z.user_id ||
                t("adminPage.activity.unknownUser");

              const co = z.match_no
                ? `#${z.match_no} ${z.team_a} — ${z.team_b}`
                : z.stage || z.phase || "";

              // Wynik meczu nie ma autora - wtedy etykieta zdarzenia JEST
              // nagłówkiem. Powtórzona jeszcze raz w opisie dawała
              // "Wpisano wynik Wpisano wynik".
              const bezAutora = z.kind === "matchResult";

              const naglowek = bezAutora
                ? t("adminPage.activity.kind.matchResult")
                : kto;

              const opis = bezAutora
                ? co
                : [t(`adminPage.activity.kind.${z.kind}`), co]
                    .filter(Boolean)
                    .join(" · ");

              return (
                <div
                  className="ui-row ui-row--between ui-row--full"
                  key={`${z.kind}-${z.user_id ?? "x"}-${z.match_id ?? "x"}-${z.at}-${i}`}
                >
                  <span>
                    {IKONY[z.kind] ?? "•"} <strong>{naglowek}</strong>{" "}
                    <span className="ui-hint">{opis}</span>
                  </span>

                  <span className="ui-hint" title={z.at}>
                    {kiedy(t, z.at)}
                  </span>
                </div>
              );
            })}
          </div>

          <p className="ui-hint">
            {t("adminPage.activity.shown", { count: items.length })}
          </p>
        </>
      )}

      <button type="button" onClick={() => pobierz(false)} disabled={odswiezam}>
        {odswiezam
          ? t("adminPage.activity.refreshing")
          : t("adminPage.activity.refresh")}
      </button>
    </div>
  );
}

export default ActivityPanel;
