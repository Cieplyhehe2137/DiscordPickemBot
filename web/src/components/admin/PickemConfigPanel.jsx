import { useEffect, useState } from "react";
import Ladowanie from "../../components/Ladowanie.jsx";

import {
  getEventPickemConfig,
  saveEventPickemConfig,
} from "../../lib/api.js";

// Konfiguracja typowania DRUŻYN dla konkretnego eventu.
//
// Typowanie drużyn to osobny byt od typowania meczów: mecze konfiguruje się
// w sekcji "Mecze", a tutaj ustala się, które fazy Pick'Em ten turniej ma
// i ile drużyn wchodzi w każdą kategorię.
//
// Do tej pory te liczby były zaszyte w kodzie w kilkunastu miejscach naraz,
// więc każdy turniej musiał mieć identyczny format. Event bez zapisanej
// konfiguracji dostaje wartości domyślne - czyli zachowanie sprzed zmiany.

const ETYKIETY_FAZ = {
  stage1: "Swiss Stage 1",
  stage2: "Swiss Stage 2",
  stage3: "Swiss Stage 3",
  playin: "Play-In",
  playoffs: "Playoffs",
  doubleelim: "Double Elimination",
};

const ETYKIETY_GRUP = {
  x3_0: "Drużyny 3-0",
  x0_3: "Drużyny 0-3",
  advancing: "Awansujące",
  teams: "Drużyny awansujące",
  semifinalists: "Półfinaliści",
  finalists: "Finaliści",
  winner: "Zwycięzca",
  third: "3. miejsce (opcjonalne)",
  upperFinalA: "Upper Final A",
  lowerFinalA: "Lower Final A",
  upperFinalB: "Upper Final B",
  lowerFinalB: "Lower Final B",
};

function PickemConfigPanel({ slug }) {
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
          setBlad(err.message || "Nie udało się wczytać konfiguracji.");
        }
      } finally {
        if (!anulowane) setZaladowane(true);
      }
    })();

    return () => {
      anulowane = true;
    };
  }, [slug]);

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
          ? `Zapisano. Ten event ma ${wlaczone.length} faz typowania drużyn: ${wlaczone
              .map((f) => ETYKIETY_FAZ[f.faza])
              .join(", ")}.`
          : "Zapisano. Ten event nie ma włączonej żadnej fazy typowania drużyn.",
      );
    } catch (err) {
      setBlad(err.message || "Nie udało się zapisać konfiguracji.");
    } finally {
      setZapisywanie(false);
    }
  }

  if (!zaladowane) {
    return <Ladowanie>Wczytywanie konfiguracji...</Ladowanie>;
  }

  return (
    <div className="pickem-config">
      <p className="ops-hint">
        Typowanie drużyn jest niezależne od typowania meczów. Włącz fazy, które
        ten turniej faktycznie ma, i ustaw liczbę drużyn w każdej kategorii.
        Fazę można zmieniać tylko dopóki nikt nie oddał w niej typu i nie ma
        wpisanego wyniku — potem zostaje zablokowana, żeby zapisane typy
        zgadzały się z zasadami, według których powstały.
        {!skonfigurowany &&
          " Ten event nie ma jeszcze własnej konfiguracji — poniżej wartości domyślne."}
      </p>

      {fazy.map((wpis) => (
        <div
          className={[
            "pickem-config__phase",
            wpis.enabled ? "pickem-config__phase--on" : "",
            wpis.zamrozona ? "pickem-config__phase--zamrozona" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          key={wpis.faza}
        >
          <label className="pickem-config__head">
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
            <p className="pickem-config__zamrozenie">
              🔒 Zablokowane — {wpis.powodZamrozenia}
            </p>
          )}

          {wpis.enabled && (
            <div className="pickem-config__limits">
              {Object.entries(wpis.limity ?? {}).map(([grupa, wartosc]) => (
                <label className="pickem-config__limit" key={grupa}>
                  <span>{ETYKIETY_GRUP[grupa] ?? grupa}</span>

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
        {zapisywanie ? "Zapisywanie..." : "Zapisz konfigurację"}
      </button>

      {komunikat && (
        <p className="admin-feedback admin-feedback--success">{komunikat}</p>
      )}

      {blad && <p className="admin-feedback admin-feedback--error">{blad}</p>}
    </div>
  );
}

export default PickemConfigPanel;
