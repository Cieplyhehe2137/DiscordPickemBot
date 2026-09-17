import { useState } from "react";

import {
  createMatchesBulk,
  getClearPhasePreview,
  clearPhase,
  getResultProposals,
  syncResultProposals,
  acceptResultProposal,
  rejectResultProposal,
  listBackups,
  createBackup,
  restoreBackup,
  backupDownloadUrl,
  classificationExportUrl,
  endTournament,
} from "../../lib/api.js";
import { useConfirm } from "../ui/useConfirm.js";
import { T } from "../../i18n/T.jsx";
import { useT } from "../../i18n/useLanguage.js";

// Operacje turniejowe, które po przepisaniu frontu zostały wyłącznie
// na Discordzie: hurtowe tworzenie meczów, czyszczenie fazy, propozycje
// wyników z zewnętrznego dostawcy, kopie zapasowe i zamknięcie turnieju.
//
// Wszystkie te endpointy istniały w backendzie bez jednego wywołania z UI.

const FAZY_MECZOWE = [
  { klucz: "swiss_stage1", etykieta: "Swiss Stage 1" },
  { klucz: "swiss_stage2", etykieta: "Swiss Stage 2" },
  { klucz: "swiss_stage3", etykieta: "Swiss Stage 3" },
  { klucz: "playin", etykieta: "Play-In" },
  { klucz: "playoffs", etykieta: "Playoffs" },
  { klucz: "doubleelim", etykieta: "Double Elimination" },
];

function Komunikaty({ ok, blad }) {
  return (
    <>
      {ok && <p className="ui-note ui-note--ok">{ok}</p>}
      {blad && <p className="ui-note ui-note--danger">{blad}</p>}
    </>
  );
}

/* ---------------- Hurtowe tworzenie meczów ---------------- */

function HurtoweMecze({ guildId, slug }) {
  const t = useT();

  const [faza, setFaza] = useState("swiss_stage1");
  const [tekst, setTekst] = useState("");
  const [bo, setBo] = useState(3);
  const [podglad, setPodglad] = useState(null);
  const [pracuje, setPracuje] = useState(false);
  const [ok, setOk] = useState("");
  const [blad, setBlad] = useState("");

  async function uruchom(dryRun) {
    setPracuje(true);
    setOk("");
    setBlad("");

    try {
      const dane = await createMatchesBulk(guildId, slug, {
        phase: faza,
        text: tekst,
        defaultBestOf: Number(bo),
        dryRun,
      });

      if (dryRun) {
        setPodglad(dane);
      } else {
        setPodglad(null);
        setTekst("");
        setOk(`Utworzono mecze: ${dane.utworzone ?? dane.created ?? "?"}.`);
      }
    } catch (err) {
      setBlad(err.message || t("admin.ops.bulk.error"));
    } finally {
      setPracuje(false);
    }
  }

  return (
    <div className="ui-card ui-card--flat ui-stack ui-stack--tight">
      <h4>{t("admin.ops.bulk.title")}</h4>

      <p className="ui-hint">
        <T
          k="admin.ops.bulk.hint"
          vars={{
            format: <code>Team A vs Team B</code>,
            example: <code>NAVI vs G2 BO3</code>,
          }}
        />
      </p>

      <div className="ui-row ui-row--wrap">
        <select value={faza} onChange={(e) => setFaza(e.target.value)}>
          {FAZY_MECZOWE.map((f) => (
            <option key={f.klucz} value={f.klucz}>
              {f.etykieta}
            </option>
          ))}
        </select>

        <select value={bo} onChange={(e) => setBo(e.target.value)}>
          <option value={1}>{t("admin.ops.bulk.defaultBo", { bo: 1 })}</option>
          <option value={3}>{t("admin.ops.bulk.defaultBo", { bo: 3 })}</option>
          <option value={5}>{t("admin.ops.bulk.defaultBo", { bo: 5 })}</option>
        </select>
      </div>

      <textarea
        rows={6}
        value={tekst}
        onChange={(e) => setTekst(e.target.value)}
        placeholder={"NAVI vs G2 BO3\nVitality vs FaZe"}
      />

      <div className="ui-row ui-row--wrap">
        <button type="button" onClick={() => uruchom(true)} disabled={pracuje}>
          {t("admin.ops.bulk.preview")}
        </button>

        <button
          type="button"
          onClick={() => uruchom(false)}
          disabled={pracuje || !podglad}
          title={!podglad ? t("admin.ops.bulk.previewFirst") : ""}
        >
          {pracuje
            ? t("admin.ops.working")
            : t("admin.ops.bulk.create")}
        </button>
      </div>

      {podglad && (
        <div className="ui-card ui-card--flat ui-card--tight">
          <strong>{t("admin.ops.bulk.preview")}</strong>

          <pre>{JSON.stringify(podglad, null, 2).slice(0, 1500)}</pre>
        </div>
      )}

      <Komunikaty ok={ok} blad={blad} />
    </div>
  );
}

/* ---------------- Czyszczenie fazy ---------------- */

function CzyszczenieFazy({ slug }) {
  const t = useT();

  const confirm = useConfirm();

  const [faza, setFaza] = useState("swiss_stage1");
  const [podglad, setPodglad] = useState(null);
  const [pracuje, setPracuje] = useState(false);
  const [ok, setOk] = useState("");
  const [blad, setBlad] = useState("");

  async function pobierzPodglad() {
    setPracuje(true);
    setOk("");
    setBlad("");

    try {
      setPodglad(await getClearPhasePreview(slug, faza));
    } catch (err) {
      setBlad(err.message || t("admin.ops.clear.previewError"));
    } finally {
      setPracuje(false);
    }
  }

  async function wyczysc() {
    // Operacja nieodwracalna - podgląd jest obowiązkowy, a potwierdzenie
    // wymaga zobaczenia liczb, które zniknią. Idą osobną listą, bo przy
    // takim pytaniu to one są treścią, a nie zdanie obok nich.
    const potwierdzone = await confirm({
      title: t("admin.ops.clear.confirmTitle", { phase: faza }),
      description: t("admin.ops.clear.confirmText"),
      details: [
        { label: t("admin.ops.clear.matches"), value: podglad?.matches ?? "?" },
        {
          label: t("admin.ops.clear.predictions"),
          value: podglad?.predictions ?? "?",
        },
      ],
      confirmLabel: t("admin.ops.clear.button"),
      tone: "danger",
    });

    if (!potwierdzone) {
      return;
    }

    setPracuje(true);
    setOk("");
    setBlad("");

    try {
      await clearPhase(slug, faza);
      setPodglad(null);
      setOk(t("admin.ops.clear.done", { phase: faza }));
    } catch (err) {
      setBlad(err.message || t("admin.ops.clear.error"));
    } finally {
      setPracuje(false);
    }
  }

  return (
    <div className="ui-card ui-card--flat ui-stack ui-stack--tight ui-card--danger">
      <h4>{t("admin.ops.clear.title")}</h4>

      <p className="ui-hint">{t("admin.ops.clear.hint")}</p>

      <div className="ui-row ui-row--wrap">
        <select value={faza} onChange={(e) => setFaza(e.target.value)}>
          {FAZY_MECZOWE.map((f) => (
            <option key={f.klucz} value={f.klucz}>
              {f.etykieta}
            </option>
          ))}
        </select>

        <button type="button" onClick={pobierzPodglad} disabled={pracuje}>
          {t("admin.ops.clear.check")}
        </button>
      </div>

      {podglad && (
        <div className="ui-card ui-card--flat ui-card--tight">
          <strong>{t("admin.ops.clear.toDelete")}</strong>{" "}
          {t("admin.ops.clear.counts", {
            matches: podglad.matches,
            predictions: podglad.predictions,
            results: podglad.results,
            points: podglad.points,
          })}
          <button
            type="button"
            className="ui-btn ui-btn--danger"
            onClick={wyczysc}
            disabled={pracuje}
          >
            {t("admin.ops.clear.button")}
          </button>
        </div>
      )}

      <Komunikaty ok={ok} blad={blad} />
    </div>
  );
}

/* ---------------- Propozycje wyników ---------------- */

function PropozycjeWynikow({ slug }) {
  const t = useT();

  const [dane, setDane] = useState(null);
  const [pracuje, setPracuje] = useState(false);
  const [ok, setOk] = useState("");
  const [blad, setBlad] = useState("");

  async function wczytaj() {
    setPracuje(true);
    setBlad("");

    try {
      setDane(await getResultProposals(slug));
    } catch (err) {
      setBlad(err.message || t("admin.ops.proposals.listError"));
    } finally {
      setPracuje(false);
    }
  }

  async function pobierzZDostawcy() {
    setPracuje(true);
    setOk("");
    setBlad("");

    try {
      const wynik = await syncResultProposals(slug);
      setOk(
        `Pobrano z dostawcy. Nowych propozycji: ${wynik.utworzone ?? wynik.created ?? 0}.`,
      );
      await wczytaj();
    } catch (err) {
      setBlad(err.message || t("admin.ops.proposals.syncError"));
    } finally {
      setPracuje(false);
    }
  }

  async function rozstrzygnij(id, akcja) {
    setBlad("");
    setOk("");

    try {
      if (akcja === "accept") await acceptResultProposal(id);
      else await rejectResultProposal(id);

      setOk(
        akcja === "accept"
          ? t("admin.ops.proposals.accepted")
          : t("admin.ops.proposals.rejected"),
      );
      await wczytaj();
    } catch (err) {
      setBlad(err.message || t("admin.ops.proposals.resolveError"));
    }
  }

  const propozycje = dane?.proposals ?? [];

  return (
    <div className="ui-card ui-card--flat ui-stack ui-stack--tight">
      <h4>{t("admin.ops.proposals.title")}</h4>

      <p className="ui-hint">
        {t("admin.ops.proposals.hint")}
        {dane &&
          !dane.providerConfigured &&
          t("admin.ops.proposals.noProvider")}
      </p>

      <div className="ui-row ui-row--wrap">
        <button type="button" onClick={wczytaj} disabled={pracuje}>
          {t("admin.ops.proposals.show")}
        </button>

        <button type="button" onClick={pobierzZDostawcy} disabled={pracuje}>
          {pracuje
            ? t("admin.ops.working")
            : t("admin.ops.proposals.fetch")}
        </button>
      </div>

      {dane && propozycje.length === 0 && (
        <p className="ui-hint">{t("admin.ops.proposals.empty")}</p>
      )}

      {propozycje.map((p) => (
        <div className="ui-card ui-card--flat ui-card--tight" key={p.id}>
          <span>
            #{p.match_id} {p.team_a} {p.res_a}:{p.res_b} {p.team_b}
          </span>

          <div className="ui-row ui-row--wrap">
            <button type="button" onClick={() => rozstrzygnij(p.id, "accept")}>
              {t("admin.ops.proposals.accept")}
            </button>

            <button type="button" onClick={() => rozstrzygnij(p.id, "reject")}>
              {t("admin.ops.proposals.reject")}
            </button>
          </div>
        </div>
      ))}

      <Komunikaty ok={ok} blad={blad} />
    </div>
  );
}

/* ---------------- Kopie zapasowe ---------------- */

function Backupy({ guildId }) {
  const t = useT();

  const confirm = useConfirm();

  const [lista, setLista] = useState(null);
  const [pracuje, setPracuje] = useState(false);
  const [ok, setOk] = useState("");
  const [blad, setBlad] = useState("");

  async function wczytaj() {
    setPracuje(true);
    setBlad("");

    try {
      const dane = await listBackups(guildId);
      setLista(dane.backups ?? []);
    } catch (err) {
      setBlad(err.message || t("admin.ops.backup.listError"));
    } finally {
      setPracuje(false);
    }
  }

  async function utworz() {
    setPracuje(true);
    setOk("");
    setBlad("");

    try {
      await createBackup(guildId);
      setOk("Kopia zapasowa utworzona.");
      await wczytaj();
    } catch (err) {
      setBlad(err.message || t("admin.ops.backup.createError"));
    } finally {
      setPracuje(false);
    }
  }

  async function przywroc(nazwa) {
    const potwierdzone = await confirm({
      title: t("admin.ops.backup.confirmTitle", { name: nazwa }),
      description: t("admin.ops.backup.confirmText"),
      confirmLabel: t("admin.ops.backup.confirmButton"),
      tone: "danger",
    });

    if (!potwierdzone) {
      return;
    }

    setPracuje(true);
    setOk("");
    setBlad("");

    try {
      await restoreBackup(guildId, nazwa);
      setOk(t("admin.ops.backup.restored", { name: nazwa }));
    } catch (err) {
      setBlad(err.message || t("admin.ops.backup.restoreError"));
    } finally {
      setPracuje(false);
    }
  }

  return (
    <div className="ui-card ui-card--flat ui-stack ui-stack--tight">
      <h4>{t("admin.ops.backup.title")}</h4>

      <div className="ui-row ui-row--wrap">
        <button type="button" onClick={wczytaj} disabled={pracuje}>
          {t("admin.ops.backup.show")}
        </button>

        <button type="button" onClick={utworz} disabled={pracuje}>
          {pracuje
            ? t("admin.ops.working")
            : t("admin.ops.backup.create")}
        </button>
      </div>

      {lista && lista.length === 0 && (
        <p className="ui-hint">{t("admin.ops.backup.empty")}</p>
      )}

      {(lista ?? []).map((kopia) => {
        const nazwa = kopia.fileName ?? kopia.name ?? kopia;

        return (
          <div
            className="ui-row ui-row--between ui-row--wrap ui-row--full"
            key={nazwa}
          >
            <span>{nazwa}</span>

            <div className="ui-row ui-row--wrap">
              <a href={backupDownloadUrl(guildId, nazwa)}>
                {t("admin.ops.backup.download")}
              </a>

              <button type="button" onClick={() => przywroc(nazwa)}>
                {t("admin.ops.backup.restore")}
              </button>
            </div>
          </div>
        );
      })}

      <Komunikaty ok={ok} blad={blad} />
    </div>
  );
}

/* ---------------- Zamknięcie turnieju ---------------- */

function ZamknijTurniej({ slug }) {
  const t = useT();

  const confirm = useConfirm();

  const [nazwa, setNazwa] = useState("");
  const [cleanup, setCleanup] = useState(false);
  const [pracuje, setPracuje] = useState(false);
  const [ok, setOk] = useState("");
  const [blad, setBlad] = useState("");

  async function zakoncz() {
    const potwierdzone = await confirm({
      title: t("admin.ops.end.confirmTitle"),
      description: cleanup
        ? t("admin.ops.end.confirmCleanup")
        : t("admin.ops.end.confirmPlain"),
      confirmLabel: cleanup
        ? t("admin.ops.end.confirmCleanupButton")
        : t("admin.ops.end.title"),
      tone: cleanup ? "danger" : undefined,
    });

    if (!potwierdzone) {
      return;
    }

    setPracuje(true);
    setOk("");
    setBlad("");

    try {
      await endTournament(slug, { archiveName: nazwa || null, cleanup });
      setOk(t("admin.ops.end.done"));
    } catch (err) {
      setBlad(err.message || t("admin.ops.end.error"));
    } finally {
      setPracuje(false);
    }
  }

  return (
    <div className="ui-card ui-card--flat ui-stack ui-stack--tight ui-card--danger">
      <h4>{t("admin.ops.end.title")}</h4>

      <p className="ui-hint">{t("admin.ops.end.hint")}</p>

      <div className="ui-row ui-row--wrap">
        <input
          type="text"
          value={nazwa}
          onChange={(e) => setNazwa(e.target.value)}
          placeholder={t("admin.ops.end.archiveName")}
        />

        <a href={classificationExportUrl(slug)}>
          {t("admin.ops.end.classification")}
        </a>
      </div>

      <label className="ui-row">
        <input
          type="checkbox"
          checked={cleanup}
          onChange={(e) => setCleanup(e.target.checked)}
        />
        {t("admin.ops.end.cleanup")}
      </label>

      <button
        type="button"
        className="ui-btn ui-btn--danger"
        onClick={zakoncz}
        disabled={pracuje}
      >
        {pracuje
          ? t("admin.ops.end.working")
          : t("admin.ops.end.title")}
      </button>

      <Komunikaty ok={ok} blad={blad} />
    </div>
  );
}

function TournamentOpsPanel({ guildId, slug }) {
  return (
    <div className="ui-stack">
      <HurtoweMecze guildId={guildId} slug={slug} />
      <PropozycjeWynikow slug={slug} />
      <Backupy guildId={guildId} />
      <CzyszczenieFazy slug={slug} />
      <ZamknijTurniej slug={slug} />
    </div>
  );
}

export default TournamentOpsPanel;
