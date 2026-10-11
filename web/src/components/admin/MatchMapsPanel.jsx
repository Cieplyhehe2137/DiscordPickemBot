import { useState } from "react";

import { getPublicMatch, saveMatchMaps } from "../../lib/api.js";
import { useT } from "../../i18n/useLanguage.js";
import { getMapLabel, mapNameFor, maxMapsFromBo } from "../../lib/mapLabels.js";

/*
 * MAPY PO VETO - wpis administratora.
 *
 * Tabela `match_maps` stala pusta od poczatku: ma wlasciwy ksztalt, ale nic
 * do niej nie pisalo, wiec serwis nie mowil ani slowa o tym, ze mapa druga
 * to Nuke. To jest pierwsza droga, ktora ja wypelnia - druga jest skrypt
 * dociagajacy dane od dostawcy.
 *
 * DLACZEGO PRZYCISK, A NIE OTWARTY FORMULARZ. Veto dotyczy jednego meczu
 * naraz i trwa minute, a lista w panelu miewa czterdziesci wierszy. Gdyby
 * kazdy z nich mial od razu trzy pola i przycisk zapisu, karta meczu
 * urosloby dwukrotnie dla rzeczy, ktorej zwykle sie nie robi. Mapy doczytuja
 * sie DOPIERO po rozwinieciu - inaczej kazde wejscie na liste meczow
 * kosztowaloby czterdziesci zapytan o dane, ktorych nikt nie oglada.
 *
 * DLACZEGO NIE <details>. Pierwsza wersja uzywala <details>/<summary>
 * i administrator NIE ZOBACZYL jej w panelu. Powod: byl to jedyny <details>
 * w calym projekcie, a design system nie ma ani jednej reguly dla
 * <summary>. Preflight Tailwinda (wciagany swiadomie w index.css) zdejmuje
 * elementom wyglad domyslny, wiec <summary> wyrenderowal sie jako zwykly
 * szary tekst posrod innych etykiet - bez obrysu, bez strzalki, bez niczego,
 * co mowi "kliknij mnie". Dokladnie ta sama pulapka, co pola formularzy bez
 * klasy .ui-input.
 *
 * Teraz jest to przycisk `ui-btn`, czyli ten sam wzorzec, co przelacznik
 * "pokaż kandydatów poza listą" w MvpAdminPanel.
 */
export default function MatchMapsPanel({ match }) {
  const t = useT();

  const ile = maxMapsFromBo(match.best_of);

  const [otwarty, setOtwarty] = useState(false);
  const [wczytane, setWczytane] = useState(false);
  const [nazwy, setNazwy] = useState(() => Array(ile).fill(""));
  const [zapisywanie, setZapisywanie] = useState(false);
  const [komunikat, setKomunikat] = useState(null);

  async function wczytaj() {
    try {
      const dane = await getPublicMatch(match.id);

      const mapy = Array.isArray(dane.maps) ? dane.maps : [];

      setNazwy(
        Array.from({ length: ile }, (_, i) => mapNameFor(mapy, i + 1) ?? ""),
      );
    } catch {
      // Brak map to normalny stan, nie blad - formularz zostaje pusty.
      setNazwy(Array(ile).fill(""));
    } finally {
      setWczytane(true);
    }
  }

  function przelacz() {
    const teraz = !otwarty;

    setOtwarty(teraz);

    if (teraz && !wczytane) wczytaj();
  }

  async function zapisz() {
    setZapisywanie(true);
    setKomunikat(null);

    try {
      const odpowiedz = await saveMatchMaps(match.id, nazwy);

      // Nieznana nazwa NIE jest bledem - pula map zmienia sie co kilka
      // miesiecy. Ale najczesciej jest literowka, wiec panel ma o tym
      // powiedziec zamiast milczec.
      setKomunikat(
        odpowiedz.unknown?.length
          ? {
            ton: "warn",
            tekst: t("admin.maps.unknown", {
              names: odpowiedz.unknown.join(", "),
            }),
          }
          : { ton: "ok", tekst: t("admin.maps.saved") },
      );
    } catch (err) {
      setKomunikat({ ton: "err", tekst: err.message || t("admin.maps.error") });
    } finally {
      setZapisywanie(false);
    }
  }

  if (!ile) return null;

  return (
    <div className="ui-stack ui-stack--tight">
      <button
        type="button"
        className="ui-btn ui-btn--sm ui-btn--ghost"
        aria-expanded={otwarty}
        onClick={przelacz}
      >
        {otwarty ? "\u25be" : "\u25b8"} {t("admin.maps.title")}
      </button>

      {otwarty && (
        <div className="ui-stack ui-stack--tight">
          <p className="ui-hint">{t("admin.maps.hint")}</p>

          {Array.from({ length: ile }, (_, i) => (
            <label className="ui-field" key={i}>
              <span className="ui-field__label">
                {t("admin.maps.map", { no: i + 1 })}
                {" · "}
                {getMapLabel(i + 1, match.best_of, match.team_a, match.team_b)}
              </span>

              <input
                className="ui-input"
                type="text"
                value={nazwy[i] ?? ""}
                placeholder="Mirage"
                onChange={(event) => {
                  const wartosc = event.target.value;

                  setNazwy((biezace) =>
                    biezace.map((n, idx) => (idx === i ? wartosc : n)),
                  );
                }}
              />
            </label>
          ))}

          <button
            className="ui-btn"
            type="button"
            onClick={zapisz}
            disabled={zapisywanie || !wczytane}
          >
            {zapisywanie ? t("admin.maps.saving") : t("admin.maps.save")}
          </button>

          {komunikat && (
            <p
              className={
                komunikat.ton === "ok"
                  ? "ui-note ui-note--ok"
                  : komunikat.ton === "warn"
                    ? "ui-note ui-note--warn"
                    : "ui-note ui-note--err"
              }
            >
              {komunikat.tekst}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
