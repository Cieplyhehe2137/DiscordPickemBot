import { useEffect, useState } from "react";
import Ladowanie from "../../components/Ladowanie.jsx";

import { getEventPickemConfig, saveEventPickemConfig } from "../../lib/api.js";
import { translateApiMessage } from "../../lib/apiMessages.js";
import { useT } from "../../i18n/useLanguage.js";

// Konfiguracja typowania DRUŻYN dla konkretnego eventu.
//
// Typowanie drużyn to osobny byt od typowania meczów: mecze konfiguruje się
// w sekcji "Mecze", a tutaj ustala się, które fazy Pick'Em ten turniej ma
// i ile drużyn wchodzi w każdą kategorię.
//
// Do tej pory te liczby były zaszyte w kodzie w kilkunastu miejscach naraz,
// więc każdy turniej musiał mieć identyczny format. Event bez zapisanej
// konfiguracji dostaje wartości domyślne - czyli zachowanie sprzed zmiany.

// Nazwy etapów i meczów drabinki zostają po angielsku we wszystkich
// językach - tak nazywa je organizator. Tłumaczone są wyłącznie nazwy
// KATEGORII, bo to nasze własne słowa, a nie terminy ze sceny.
const ETYKIETY_FAZ = {
  stage1: "Swiss Stage 1",
  stage2: "Swiss Stage 2",
  stage3: "Swiss Stage 3",
  playin: "Play-In",
  playoffs: "Playoffs",
  doubleelim: "Double Elimination",
};

const KLUCZE_GRUP = {
  x3_0: "phaseResults.teams30",
  x0_3: "phaseResults.teams03",
  advancing: "phaseResults.advancing",
  teams: "phaseResults.advancingTeams",
  semifinalists: "phaseResults.semifinalists",
  finalists: "phaseResults.finalists",
  winner: "phaseResults.winner",
  third: "admin.group.thirdOptional",
};

const DRABINKA = {
  upperFinalA: "Upper Final A",
  lowerFinalA: "Lower Final A",
  upperFinalB: "Upper Final B",
  lowerFinalB: "Lower Final B",
};

function etykietaGrupy(t, grupa) {
  if (KLUCZE_GRUP[grupa]) return t(KLUCZE_GRUP[grupa]);

  return DRABINKA[grupa] ?? grupa;
}

function PickemConfigPanel({ slug }) {
  const t = useT();

  const [fazy, setFazy] = useState([]);
  const [skonfigurowany, setSkonfigurowany] = useState(false);
  const [zaladowane, setZaladowane] = useState(false);
  const [zapisywanie, setZapisywanie] = useState(false);
  const [komunikat, setKomunikat] = useState("");
  const [blad, setBlad] = useState("");

  useEffect(() => {
    let anulowane = false;

    (async () => {
      try {
        const dane = await getEventPickemConfig(slug);

        if (anulowane) return;

        setFazy(dane.fazy ?? []);
        setSkonfigurowany(Boolean(dane.skonfigurowany));
        setBlad("");
      } catch (err) {
        console.error("PICKEM CONFIG LOAD:", err);

        if (!anulowane) {
          setBlad(err.message || t("admin.config.loadError"));
        }
      } finally {
        if (!anulowane) setZaladowane(true);
      }
    })();

    return () => {
      anulowane = true;
    };
  }, [slug, t]);

  function przelaczFaze(faza) {
    setKomunikat("");
    setFazy((biezace) =>
      biezace.map((wpis) =>
        wpis.faza === faza && !wpis.zamrozona
          ? { ...wpis, enabled: !wpis.enabled }
          : wpis,
      ),
    );
  }

  function zmienLimit(faza, grupa, wartosc) {
    const liczba = Number(wartosc);

    setKomunikat("");
    setFazy((biezace) =>
      biezace.map((wpis) =>
        wpis.faza === faza && !wpis.zamrozona
          ? {
              ...wpis,
              limity: {
                ...wpis.limity,
                [grupa]: Number.isFinite(liczba) ? liczba : 0,
              },
            }
          : wpis,
      ),
    );
  }

  async function zapisz() {
    setZapisywanie(true);
    setBlad("");
    setKomunikat("");

    try {
      const odpowiedz = await saveEventPickemConfig(slug, fazy);

      setFazy(odpowiedz.fazy ?? fazy);
      setSkonfigurowany(true);

      const wlaczone = (odpowiedz.fazy ?? fazy).filter((f) => f.enabled);

      setKomunikat(
        wlaczone.length
          ? t("admin.config.savedWith", {
              count: wlaczone.length,
              phases: wlaczone
                .map((f) => ETYKIETY_FAZ[f.faza])
                .join(", "),
            })
          : t("admin.config.savedEmpty"),
      );
    } catch (err) {
      setBlad(err.message || t("admin.config.saveError"));
    } finally {
      setZapisywanie(false);
    }
  }

  if (!zaladowane) {
    return <Ladowanie>{t("admin.config.loading")}</Ladowanie>;
  }

  return (
    <div className="ui-stack">
      <p className="ui-hint">
        {t("admin.config.hint")}
        {!skonfigurowany && t("admin.config.noConfig")}
      </p>

      {fazy.map((wpis) => (
        // Faza to KARTA, nie przycisk wyboru: w środku siedzi checkbox,
        // notka o blokadzie i pola z limitami. Wcześniej stały tu trzy klasy
        // (ui-stack__phase i dwa modyfikatory), do których nie istniała ani
        // jedna reguła CSS - kontener nie miał ani tła, ani obramowania, ani
        // odstępu. Stan "włączona" niesie ui-card--selected; stan "zamrożona"
        // niosła klasa, która nic nie robiła, a mówi o nim notka w środku
        // i wyłączony checkbox.
        <div
          className={[
            "ui-card ui-card--flat ui-card--tight ui-stack ui-stack--tight",
            wpis.enabled ? "ui-card--selected" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          key={wpis.faza}
        >
          <label className="ui-row">
            <input
              type="checkbox"
              checked={wpis.enabled}
              disabled={wpis.zamrozona}
              onChange={() => przelaczFaze(wpis.faza)}
            />

            <strong>{ETYKIETY_FAZ[wpis.faza] ?? wpis.faza}</strong>
          </label>

          {/* Zapisane typy były sprawdzane wobec innych liczb, więc zmiana
              limitu nie naprawiłaby ich, tylko rozjechała turniej. */}
          {wpis.zamrozona && (
            <p className="ui-note ui-note--warn">
              🔒{" "}
              {t("admin.config.locked", {
                reason: translateApiMessage(
                  wpis.powodZamrozeniaCode,
                  wpis.powodZamrozenia,
                ),
              })}
            </p>
          )}

          {wpis.enabled && (
            <div className="ui-row ui-row--wrap">
              {Object.entries(wpis.limity ?? {}).map(([grupa, wartosc]) => (
                <label className="ui-field" key={grupa}>
                  <span>{etykietaGrupy(t, grupa)}</span>

                  <input
                    type="number"
                    min="0"
                    max="64"
                    value={wartosc}
                    disabled={wpis.zamrozona}
                    onChange={(event) =>
                      zmienLimit(wpis.faza, grupa, event.target.value)
                    }
                  />
                </label>
              ))}
            </div>
          )}
        </div>
      ))}

      <button type="button" onClick={zapisz} disabled={zapisywanie}>
        {zapisywanie ? t("admin.saving") : t("admin.config.save")}
      </button>

      {komunikat && <p className="ui-note ui-note--ok">{komunikat}</p>}

      {blad && <p className="ui-note ui-note--danger">{blad}</p>}
    </div>
  );
}

export default PickemConfigPanel;
