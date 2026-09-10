import { useState } from "react";

import { startEventPickem } from "../../lib/api.js";

// Uruchomienie typowania z WWW ma dać dokładnie to samo, co komenda na
// Discordzie: przestawienie stanu turnieju i panel na kanale. Robi to jedna
// funkcja po stronie bota (publishPickemPanel), a że bot i serwer to osobne
// procesy, API zapisuje zlecenie w bazie i bot podnosi je swoim watcherem.
//
// Mieszka obok przycisków statusu, a nie w operacjach turniejowych, bo to
// jedyna rzecz na WWW, która faktycznie publikuje panel. Schowany pod
// "Operacje" był w praktyce nie do znalezienia i ludzie klikali "Otwórz
// event", który zmienia tylko status w bazie.

const FAZY = [
  { klucz: "swiss_stage1", etykieta: "Swiss Stage 1" },
  { klucz: "swiss_stage2", etykieta: "Swiss Stage 2" },
  { klucz: "swiss_stage3", etykieta: "Swiss Stage 3" },
  { klucz: "playin", etykieta: "Play-In" },
  { klucz: "playoffs", etykieta: "Playoffs" },
  { klucz: "doubleelim", etykieta: "Double Elimination" },
];

function StartPickemPanel({ slug }) {
  const [faza, setFaza] = useState("swiss_stage1");
  const [kanal, setKanal] = useState("");
  const [pracuje, setPracuje] = useState(false);
  const [ok, setOk] = useState("");
  const [blad, setBlad] = useState("");

  const etykieta = FAZY.find((f) => f.klucz === faza)?.etykieta ?? faza;

  async function uruchom() {
    if (
      !window.confirm(
        `Uruchomić typowanie fazy ${etykieta}?\n\n` +
          "Bot opublikuje panel na Discordzie i oznaczy ten turniej jako " +
          "aktywny. Dotychczasowy otwarty turniej zostanie zamknięty.",
      )
    ) {
      return;
    }

    setPracuje(true);
    setOk("");
    setBlad("");

    try {
      const odpowiedz = await startEventPickem(slug, faza, kanal.trim() || null);

      setOk(
        `Zlecono start fazy ${etykieta}. Bot opublikuje panel na kanale ` +
          `${odpowiedz.channelId} w ciągu ~${odpowiedz.opoznienieSekundy} s. ` +
          "Do tego czasu turniej pokazuje się jako nierozpoczęty.",
      );
    } catch (err) {
      setBlad(err.message || "Nie udało się uruchomić typowania.");
    } finally {
      setPracuje(false);
    }
  }

  return (
    <div className="start-pickem">
      <h3>Uruchom typowanie</h3>

      <p className="start-pickem__hint">
        Jedyna akcja, która publikuje panel typowania na Discordzie. Turniej
        staje się aktywny, a poprzedni otwarty zostaje zamknięty. Kanał
        domyślny bierze się z <code>PICKEM_CHANNEL_ID</code> w configu serwera —
        poniżej możesz go nadpisać.
      </p>

      <div className="start-pickem__row">
        <select value={faza} onChange={(e) => setFaza(e.target.value)}>
          {FAZY.map((f) => (
            <option key={f.klucz} value={f.klucz}>
              {f.etykieta}
            </option>
          ))}
        </select>

        <input
          type="text"
          value={kanal}
          onChange={(e) => setKanal(e.target.value)}
          placeholder="ID kanału (opcjonalnie)"
        />

        <button type="button" onClick={uruchom} disabled={pracuje}>
          {pracuje ? "Zlecanie..." : "🚀 Uruchom typowanie"}
        </button>
      </div>

      {ok && <p className="admin-feedback admin-feedback--success">{ok}</p>}

      {blad && <p className="admin-feedback admin-feedback--error">{blad}</p>}
    </div>
  );
}

export default StartPickemPanel;
