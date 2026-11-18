import { useEffect, useState } from "react";

import Ladowanie from "../../components/Ladowanie.jsx";
import { getEventPickStats, getGuildPickStats } from "../../lib/api.js";
import { useT } from "../../i18n/useLanguage.js";

// Ile typów faktycznie oddano - widok dla administratora serwera.
//
// PO CO. Liczby typów istniały, ale nie tam, gdzie ich szuka admin: publiczna
// strona turnieju pokazuje sumy z DWÓCH tabel (mecze i mapy) z siedmiu,
// a podział głosów na drużyny jest celowo ukryty do czasu zablokowania meczu,
// żeby gracze nie widzieli tłumu. Panel potrzebuje odwrotnego: pełnego obrazu
// NA ŻYWO, w trakcie otwartego typowania, bo właśnie wtedy decyzje admina
// mają jeszcze znaczenie.
//
// DLACZEGO OBOK KAŻDEJ SUMY STOI LICZBA GRACZY. "Typy" to liczba wierszy,
// a jeden gracz ma ich tyle, ile meczów obstawił. Suma mówi o aktywności,
// nie o frekwencji - same typy zawyżają "ilu ludzi gra" kilkukrotnie.
//
// KOMPLETNOŚĆ JEST TU NAJWAŻNIEJSZA. Sama suma nie rozróżnia turnieju,
// w którym 13 osób przeszło wszystko, od takiego, gdzie 40 osób kliknęło
// jeden mecz i zniknęło - a to zupełnie inne sytuacje dla admina.
//
// "MAPY" TO NUMER MAPY W SERII, NIE JEJ NAZWA. Nazw map system nie
// przechowuje w ogóle: match_map_results zna wyłącznie map_no, a słownika
// map nie ma. Gdyby kiedyś miały być "Mirage / Inferno", trzeba je najpierw
// zacząć zapisywać przy wyniku.

const FAZY = [
  ["mecze", "🎮"],
  ["mapy", "🗺️"],
  ["swiss", "📋"],
  ["playin", "🚪"],
  ["playoffs", "🏆"],
  ["doubleelim", "⚔️"],
  ["mvp", "⭐"],
];

// Kolumny podziału na drużyny. Pokazujemy tylko te, w których cokolwiek jest -
// inaczej turniej w fazie Swiss dostaje pięć pustych kolumn playoffowych.
const KOLUMNY_DRUZYN = [
  ["zwyciezcaMeczu", "adminPage.pickStats.col.matchWinner"],
  ["pick30", "adminPage.pickStats.col.pick30"],
  ["pick03", "adminPage.pickStats.col.pick03"],
  ["awans", "adminPage.pickStats.col.advancing"],
  ["playin", "adminPage.pickStats.col.playin"],
  ["polfinal", "adminPage.pickStats.col.semifinal"],
  ["final", "adminPage.pickStats.col.final"],
  ["mistrz", "adminPage.pickStats.col.winner"],
  ["trzecieMiejsce", "adminPage.pickStats.col.third"],
];

// Jeden wiersz "podpis - wartość". Taki sam układ, jak w liczniku typowania,
// więc nie wprowadza nowego wzorca dla trzech tabelek po dwie kolumny.
function Wiersz({ podpis, wartosc, dopisek }) {
  return (
    <div className="ui-row ui-row--between ui-row--full">
      <span>{podpis}</span>

      <span>
        <strong>{wartosc}</strong>

        {dopisek ? <span className="ui-hint"> {dopisek}</span> : null}
      </span>
    </div>
  );
}

function PickStatsPanel({ guildId, slug }) {
  const t = useT();

  const [dane, setDane] = useState(null);
  const [zbiorcze, setZbiorcze] = useState(null);
  const [zaladowane, setZaladowane] = useState(false);
  const [blad, setBlad] = useState("");
  const [odswiezanie, setOdswiezanie] = useState(false);
  const [licznik, setLicznik] = useState(0);

  useEffect(() => {
    let anulowane = false;

    (async () => {
      try {
        // Turniej i zbiorczo po serwerze to dwa czytania tego samego pytania
        // "ogółem", oba tanie - więc lecą razem, a nie po kolei.
        const [turniej, serwer] = await Promise.all([
          getEventPickStats(guildId, slug),
          getGuildPickStats(guildId),
        ]);

        if (anulowane) return;

        setDane(turniej);
        setZbiorcze(serwer);
        setBlad("");
      } catch (err) {
        console.error("PICK STATS LOAD:", err);

        if (!anulowane) {
          setBlad(err.message || t("adminPage.pickStats.loadError"));
        }
      } finally {
        if (!anulowane) {
          setZaladowane(true);
          setOdswiezanie(false);
        }
      }
    })();

    return () => {
      anulowane = true;
    };
  }, [guildId, slug, licznik, t]);

  function odswiez() {
    setOdswiezanie(true);
    setLicznik((n) => n + 1);
  }

  if (!zaladowane) {
    return <Ladowanie>{t("adminPage.pickStats.loading")}</Ladowanie>;
  }

  if (blad) {
    return <p className="ui-note ui-note--danger">{blad}</p>;
  }

  if (!dane) return null;

  const { ogolem, fazy, kompletnosc, naDruzyny, naMapy } = dane;

  const kolumnyDruzyn = KOLUMNY_DRUZYN.filter(([pole]) =>
    naDruzyny.some((d) => d[pole] > 0),
  );

  const fazyZTypami = FAZY.filter(([nazwa]) => fazy[nazwa]?.typow > 0);

  // Nazwa + razem + widoczne kolumny. Szablon musi znać ich liczbę, bo
  // ui-datatable rozstawia kolumny gridem, nie elementem <table>.
  const szablonKolumn = {
    "--ui-datatable-columns": `minmax(140px, 2fr) minmax(72px, 1fr) repeat(${kolumnyDruzyn.length}, minmax(72px, 1fr))`,
  };

  return (
    <div className="ui-stack">
      <p className="ui-hint">{t("adminPage.pickStats.hint")}</p>

      {/* Otwarte typowanie znaczy, że te liczby jeszcze rosną - bez tego
          czyta się je jak wynik końcowy. */}
      {dane.event?.otwarteTypowanie && (
        <p className="ui-note ui-note--ok">{t("adminPage.pickStats.live")}</p>
      )}

      {dane.event?.archiwalny && (
        <p className="ui-note">{t("adminPage.pickStats.archived")}</p>
      )}

      <div className="ui-stats ui-stats--4">
        <div className="ui-stat">
          <span>✓ {t("adminPage.pickStats.stat.total")}</span>

          <strong>{ogolem.typow}</strong>
        </div>

        <div className="ui-stat">
          <span>👥 {t("adminPage.pickStats.stat.players")}</span>

          <strong>{ogolem.graczy}</strong>
        </div>

        <div className="ui-stat">
          <span>🎮 {t("adminPage.pickStats.stat.matches")}</span>

          <strong>{ogolem.meczow}</strong>
        </div>

        <div className="ui-stat">
          <span>🏁 {t("adminPage.pickStats.stat.complete")}</span>

          <strong>{kompletnosc.pelne}</strong>

          <small>
            {t("adminPage.pickStats.stat.completeOf", {
              count: kompletnosc.meczow,
            })}
          </small>
        </div>
      </div>

      {/* --- podział na fazy --- */}

      <h3>{t("adminPage.pickStats.byPhase")}</h3>

      {fazyZTypami.length === 0 ? (
        <p className="ui-note">{t("adminPage.pickStats.empty")}</p>
      ) : (
        <div className="ui-stack ui-stack--tight">
          {fazyZTypami.map(([nazwa, ikona]) => (
            <Wiersz
              key={nazwa}
              podpis={`${ikona} ${t(`adminPage.pickStats.phase.${nazwa}`)}`}
              wartosc={fazy[nazwa].typow}
              dopisek={t("adminPage.pickStats.players", {
                count: fazy[nazwa].graczy,
              })}
            />
          ))}
        </div>
      )}

      {/* --- kompletność --- */}

      {kompletnosc.obstawiajacych > 0 && (
        <>
          <h3>{t("adminPage.pickStats.completeness")}</h3>

          <p className="ui-hint">
            {t("adminPage.pickStats.completenessHint")}
          </p>

          <div className="ui-stack ui-stack--tight">
            {/* Prawą kolumnę opisuje podpowiedź nad listą, więc liczba graczy
                stoi bez dopisku - inaczej wyszłoby "1 graczy". */}
            {kompletnosc.koszyki.map((k) => (
              <Wiersz
                key={k.nazwa}
                podpis={t(`adminPage.pickStats.bucket.${k.nazwa}`)}
                wartosc={k.graczy}
              />
            ))}
          </div>

          {/* Najczęstsza wartość wprost: pokazuje, gdzie ludzie przestawali
              typować. Koszyk by to zatarł. */}
          {kompletnosc.najczestszy && (
            <p className="ui-hint">
              {t("adminPage.pickStats.mostCommon", {
                picked: kompletnosc.najczestszy.ile,
                matches: kompletnosc.meczow,
                count: kompletnosc.najczestszy.graczy,
              })}
            </p>
          )}
        </>
      )}

      {/* --- na drużyny --- */}

      {naDruzyny.length > 0 && kolumnyDruzyn.length > 0 && (
        <>
          <h3>{t("adminPage.pickStats.byTeam")}</h3>

          <p className="ui-hint">{t("adminPage.pickStats.byTeamHint")}</p>

          <div className="ui-datatable" style={szablonKolumn}>
            <div className="ui-datatable__head" aria-hidden="true">
              <span>{t("adminPage.pickStats.team")}</span>

              <span>{t("adminPage.pickStats.col.total")}</span>

              {kolumnyDruzyn.map(([pole, klucz]) => (
                <span key={pole}>{t(klucz)}</span>
              ))}
            </div>

            {naDruzyny.map((d) => (
              <div className="ui-datatable__row" key={d.klucz}>
                <strong data-label={t("adminPage.pickStats.team")}>
                  {d.nazwa}
                </strong>

                <span data-label={t("adminPage.pickStats.col.total")}>
                  {d.razem}
                </span>

                {kolumnyDruzyn.map(([pole, klucz]) => (
                  <span key={pole} data-label={t(klucz)}>
                    {d[pole] || "—"}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </>
      )}

      {/* --- na mapy --- */}

      <h3>{t("adminPage.pickStats.byMap")}</h3>

      {naMapy.length === 0 ? (
        // Turniej w całości BO1 nie ma typów mapowych i nigdy nie będzie
        // miał - to nie brak danych, tylko format serii.
        <p className="ui-note">{t("adminPage.pickStats.noMaps")}</p>
      ) : (
        <>
          <p className="ui-hint">{t("adminPage.pickStats.byMapHint")}</p>

          <div className="ui-stack ui-stack--tight">
            {naMapy.map((m) => (
              <Wiersz
                key={m.mapNo}
                podpis={t("adminPage.pickStats.mapNo", { no: m.mapNo })}
                wartosc={m.typow}
                dopisek={t("adminPage.pickStats.players", {
                  count: m.graczy,
                })}
              />
            ))}
          </div>
        </>
      )}

      {/* --- cały serwer --- */}

      {zbiorcze && (
        <>
          <h3>{t("adminPage.pickStats.allEvents")}</h3>

          <p className="ui-hint">
            {t("adminPage.pickStats.allEventsHint", { count: zbiorcze.typow })}
          </p>

          <div className="ui-stack ui-stack--tight">
            {zbiorcze.turnieje.map((e) => (
              <Wiersz
                key={e.id}
                podpis={
                  e.archiwalny
                    ? `${e.name} ${t("adminPage.pickStats.archive")}`
                    : e.name
                }
                wartosc={e.typowMeczow}
                dopisek={t("adminPage.pickStats.players", { count: e.graczy })}
              />
            ))}
          </div>
        </>
      )}

      <button type="button" onClick={odswiez} disabled={odswiezanie}>
        {odswiezanie
          ? t("adminPage.pickStats.refreshing")
          : t("adminPage.pickStats.refresh")}
      </button>
    </div>
  );
}

export default PickStatsPanel;
