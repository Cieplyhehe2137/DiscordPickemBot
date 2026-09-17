import { useState } from "react";

import { startEventPickem } from "../../lib/api.js";
import { useConfirm } from "../ui/useConfirm.js";
import { T } from "../../i18n/T.jsx";
import { useT } from "../../i18n/useLanguage.js";

// Uruchomienie typowania z WWW ma dać dokładnie to samo, co komenda na
// Discordzie: przestawienie stanu turnieju i panel na kanale. Robi to jedna
// funkcja po stronie bota (publishPickemPanel), a że bot i serwer to osobne
// procesy, API zapisuje zlecenie w bazie i bot podnosi je swoim watcherem.
//
// Mieszka obok przycisków statusu, a nie w operacjach turniejowych, bo to
// jedyna rzecz na WWW, która faktycznie publikuje panel. Schowany pod
// "Operacje" był w praktyce nie do znalezienia i ludzie klikali "Otwórz
// event", który zmienia tylko status w bazie.

// Nazwy etapów zostają po angielsku we wszystkich językach - tak nazywa
// je organizator i tak stoją na drabince.
const FAZY = [
  { klucz: "swiss_stage1", etykieta: "Swiss Stage 1" },
  { klucz: "swiss_stage2", etykieta: "Swiss Stage 2" },
  { klucz: "swiss_stage3", etykieta: "Swiss Stage 3" },
  { klucz: "playin", etykieta: "Play-In" },
  { klucz: "playoffs", etykieta: "Playoffs" },
  { klucz: "doubleelim", etykieta: "Double Elimination" },
];

function StartPickemPanel({ slug }) {
  const t = useT();

  const confirm = useConfirm();

  const [faza, setFaza] = useState("swiss_stage1");
  const [kanal, setKanal] = useState("");
  const [pracuje, setPracuje] = useState(false);
  const [ok, setOk] = useState("");
  const [blad, setBlad] = useState("");

  const etykieta = FAZY.find((f) => f.klucz === faza)?.etykieta ?? faza;

  async function uruchom() {
    const potwierdzone = await confirm({
      title: t("admin.start.confirmTitle", { phase: etykieta }),
      description: t("admin.start.confirmText"),
      confirmLabel: t("admin.start.confirmButton"),
    });

    if (!potwierdzone) {
      return;
    }

    setPracuje(true);
    setOk("");
    setBlad("");

    try {
      const odpowiedz = await startEventPickem(
        slug,
        faza,
        kanal.trim() || null,
      );

      setOk(
        t("admin.start.done", {
          phase: etykieta,
          channel: odpowiedz.channelId,
          seconds: odpowiedz.opoznienieSekundy,
        }),
      );
    } catch (err) {
      setBlad(err.message || t("admin.start.error"));
    } finally {
      setPracuje(false);
    }
  }

  return (
    <div className="ui-card ui-stack">
      <h3>{t("admin.start.title")}</h3>

      <p className="ui-hint">
        <T
          k="admin.start.hint"
          vars={{ config: <code>PICKEM_CHANNEL_ID</code> }}
        />
      </p>

      <div className="ui-row ui-row--wrap">
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
          placeholder={t("admin.start.channel")}
        />

        <button type="button" onClick={uruchom} disabled={pracuje}>
          {pracuje
            ? t("admin.start.working")
            : `🚀 ${t("admin.start.title")}`}
        </button>
      </div>

      {ok && <p className="ui-note ui-note--ok">{ok}</p>}

      {blad && <p className="ui-note ui-note--danger">{blad}</p>}
    </div>
  );
}

export default StartPickemPanel;
