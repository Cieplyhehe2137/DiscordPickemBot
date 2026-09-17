import { useCallback, useEffect, useState } from "react";

import {
  deleteMvpCandidate,
  deleteMvpCandidates,
  getMvp,
  saveMvpCandidates,
  saveMvpResult,
} from "../../lib/api.js";
import Ladowanie from "../../components/Ladowanie.jsx";
import { T } from "../../i18n/T.jsx";
import { useT } from "../../i18n/useLanguage.js";
import {
  isGroupSelected,
  toggleGroup,
  toggleSelected,
} from "../../lib/selection.js";

// MVP turnieju: lista kandydatów i wskazanie zwycięzcy.
//
// Trafiony MVP daje 5 pkt (rules/scoring.js -> MVP.CORRECT) i wchodzi do
// tabeli `leaderboard`, więc bez tego panelu WWW nie było w stanie domknąć
// punktacji turnieju - operacja istniała tylko na Discordzie.
//
// Kandydatów wpisuje się tekstem, po jednym w linii: "nick" albo
// "nick, drużyna" - ten sam format co modal na Discordzie.

function parsujKandydatow(tekst) {
  return String(tekst || "")
    .split("\n")
    .map((linia) => linia.trim())
    .filter(Boolean)
    .map((linia) => {
      const [nickname, teamName] = linia.split(",").map((x) => x.trim());
      return { nickname, teamName: teamName || null };
    })
    .filter((wpis) => wpis.nickname);
}

function MvpAdminPanel({ slug }) {
  const t = useT();

  const [kandydaci, setKandydaci] = useState([]);
  const [wynik, setWynik] = useState(null);
  const [tekst, setTekst] = useState("");
  // jak wyżej: stan ładowania wyliczany, nie ustawiany w efekcie
  const [zaladowane, setZaladowane] = useState(false);
  const ladowanie = !zaladowane;
  const [zapisywanie, setZapisywanie] = useState(false);
  const [komunikat, setKomunikat] = useState("");
  const [blad, setBlad] = useState("");

  // Kasowanie potwierdzane w miejscu, a nie przez window.confirm: ten sam
  // wzorzec co przy kasowaniu meczu w panelu. Trzyma id kandydata, dla
  // którego pokazany jest pytający wiersz, i osobno id kandydata, którego
  // żądanie właśnie leci - żeby zablokować tylko ten jeden przycisk.
  const [potwierdzanyId, setPotwierdzanyId] = useState(null);
  const [usuwanyId, setUsuwanyId] = useState(null);

  // Zapis listy wyłącza starych kandydatów zamiast ich kasować, a turniej
  // przez kilka zapisów potrafi ich uzbierać kilkadziesiąt (IEM Cologne:
  // 105 wpisów, z czego 75 poza listą). Domyślnie pokazujemy tych, którzy
  // są na liście - reszta czeka za przełącznikiem, zamiast robić z panelu
  // stumetrowy przewijak.
  const [pokazPozaLista, setPokazPozaLista] = useState(false);

  // Zaznaczenie do kasowania hurtowego. Set, nie tablica: pytanie "czy ten
  // wiersz jest zaznaczony" pada raz na kandydata przy każdym renderze, a
  // przy stu kandydatach szukanie w tablicy robi z tego sto przebiegów.
  const [zaznaczone, setZaznaczone] = useState(() => new Set());
  const [potwierdzHurt, setPotwierdzHurt] = useState(false);
  const [kasowanieHurtowe, setKasowanieHurtowe] = useState(false);
  const [odrzucone, setOdrzucone] = useState([]);

  // Wywoływane też ręcznie po zapisaniu kandydatów - stąd useCallback.
  const wczytaj = useCallback(async () => {
    try {
      const dane = await getMvp(slug);

      setKandydaci(dane.candidates ?? []);
      setWynik(dane.result?.candidate_id ?? null);
      setBlad("");
    } catch (err) {
      console.error("MVP LOAD:", err);
      setBlad(err.message || t("admin.mvp.loadError"));
    } finally {
      setZaladowane(true);
    }
  }, [slug, t]);

  // Efekt trzyma własną kopię pobrania, żeby nie zawierał żadnego
  // synchronicznego setState (react-hooks/set-state-in-effect).
  useEffect(() => {
    let anulowane = false;

    (async () => {
      try {
        const dane = await getMvp(slug);

        if (anulowane) return;

        setKandydaci(dane.candidates ?? []);
        setWynik(dane.result?.candidate_id ?? null);
        setBlad("");
      } catch (err) {
        console.error("MVP LOAD:", err);

        if (!anulowane) {
          setBlad(err.message || t("admin.mvp.loadError"));
        }
      } finally {
        if (!anulowane) setZaladowane(true);
      }
    })();

    return () => {
      anulowane = true;
    };
  }, [slug, t]);

  async function zapiszKandydatow() {
    const wpisy = parsujKandydatow(tekst);

    if (!wpisy.length) {
      setBlad("Wpisz co najmniej jednego kandydata.");
      return;
    }

    setZapisywanie(true);
    setBlad("");
    setKomunikat("");

    try {
      await saveMvpCandidates(slug, wpisy);
      setTekst("");
      setKomunikat(t("admin.mvp.saved", { count: wpisy.length }));
      await wczytaj();
    } catch (err) {
      setBlad(err.message || t("admin.mvp.saveError"));
    } finally {
      setZapisywanie(false);
    }
  }

  const aktywni = kandydaci.filter((k) => Number(k.is_active));
  const pozaLista = kandydaci.filter((k) => !Number(k.is_active));

  async function usunKandydata(candidateId) {
    setBlad("");
    setKomunikat("");
    setUsuwanyId(candidateId);

    try {
      await deleteMvpCandidate(slug, candidateId);
      setPotwierdzanyId(null);
      setKomunikat(t("admin.mvp.deleted"));
      await wczytaj();
    } catch (err) {
      // Serwer odmawia, gdy ktoś już wytypował tego kandydata albo gdy jest
      // zapisany jako zwycięzca - i mówi wprost, co go trzyma. Pokazujemy tę
      // wiadomość, zamiast zastępować ją własną, ogólną.
      setBlad(err.message || t("admin.mvp.deleteError"));
    } finally {
      setUsuwanyId(null);
    }
  }

  async function ustawWynik(candidateId) {
    setBlad("");
    setKomunikat("");

    try {
      await saveMvpResult(slug, candidateId);
      setWynik(candidateId);
      setKomunikat(
        t("admin.mvp.winnerSaved"),
      );
    } catch (err) {
      setBlad(err.message || t("admin.mvp.winnerError"));
    }
  }

  function przelaczZaznaczenie(id) {
    setZaznaczone((teraz) => toggleSelected(teraz, id));
  }

  // Zaznaczenie grupowe działa na JEDNEJ grupie - osobno dla tych na liście
  // i tych poza nią. Jedno wspólne "zaznacz wszystko" zaznaczałoby też wiersze
  // schowane pod przełącznikiem, czyli takie, których nie widać.
  function czyGrupaZaznaczona(grupa) {
    return isGroupSelected(
      zaznaczone,
      grupa.map((k) => k.id),
    );
  }

  function przelaczGrupe(grupa) {
    const identyfikatory = grupa.map((k) => k.id);

    setZaznaczone((teraz) => toggleGroup(teraz, identyfikatory));
  }

  async function usunZaznaczone() {
    setBlad("");
    setKomunikat("");
    setOdrzucone([]);
    setKasowanieHurtowe(true);

    try {
      const wynikKasowania = await deleteMvpCandidates(slug, [...zaznaczone]);

      const usunietych = wynikKasowania.deleted?.length ?? 0;
      const odmowy = wynikKasowania.refused ?? [];

      setOdrzucone(odmowy);
      setZaznaczone(new Set());
      setPotwierdzHurt(false);

      // Komunikat mówi obie liczby, także gdy jedna jest zerem: "usunięto 0"
      // po kliknięciu "usuń 13" musi być widoczne, a nie ciche.
      setKomunikat(
        odmowy.length
          ? t("admin.mvp.bulkMixed", {
              deleted: usunietych,
              skipped: odmowy.length,
            })
          : t("admin.mvp.bulkDone", { count: usunietych }),
      );

      await wczytaj();
    } catch (err) {
      setBlad(err.message || t("admin.mvp.bulkError"));
    } finally {
      setKasowanieHurtowe(false);
    }
  }

  // Jeden wiersz listy kandydatów. Zwykła funkcja, nie komponent: wołana
  // jako wierszKandydata(k), więc React wstawia zwrócone elementy w drzewo
  // rodzica i nic się nie przemontowuje przy każdym renderze. Stoi w jednym
  // miejscu, bo listy są teraz dwie - na liście i poza nią - a dwie kopie
  // tego samego wiersza rozjechałyby się przy pierwszej zmianie.
  function wierszKandydata(kandydat) {
    const zwyciezca = Number(wynik) === Number(kandydat.id);
    const nieaktywny = !Number(kandydat.is_active);

    return (
      <div
        key={kandydat.id}
        className="ui-card ui-card--flat ui-card--tight ui-stack ui-stack--tight"
      >
        <div className="ui-row ui-row--between ui-row--wrap">
          <input
            type="checkbox"
            checked={zaznaczone.has(kandydat.id)}
            onChange={() => przelaczZaznaczenie(kandydat.id)}
            aria-label={t("admin.mvp.select", { name: kandydat.nickname })}
          />

          <button
            type="button"
            className="ui-choice__option ui-choice__option--stacked"
            aria-pressed={zwyciezca}
            onClick={() => ustawWynik(kandydat.id)}
            title={t("admin.mvp.setWinner")}
          >
            <strong>{kandydat.nickname}</strong>

            {kandydat.team_name && <span>{kandydat.team_name}</span>}
          </button>

          <div className="ui-row ui-row--wrap">
            {zwyciezca && <span className="ui-badge ui-badge--warn">MVP</span>}

            {/* Zapis listy nie kasuje starych wpisów, tylko je
                      wyłącza - bez tej plakietki nie było widać, którzy
                      kandydaci pochodzą z poprzedniego zapisu. */}
            {nieaktywny && (
              <span className="ui-badge">{t("admin.mvp.offList")}</span>
            )}

            <button
              type="button"
              className="ui-btn ui-btn--sm ui-btn--danger"
              disabled={usuwanyId === kandydat.id}
              onClick={() => {
                setBlad("");
                setKomunikat("");
                setPotwierdzanyId(
                  potwierdzanyId === kandydat.id ? null : kandydat.id,
                );
              }}
            >
              🗑️ {t("admin.mvp.delete")}
            </button>
          </div>
        </div>

        {potwierdzanyId === kandydat.id && (
          <div className="ui-note ui-note--danger ui-stack ui-stack--tight">
            <span>
              <T
                k="admin.mvp.deleteAsk"
                vars={{ name: <strong>{kandydat.nickname}</strong> }}
              />
            </span>

            <div className="ui-row ui-row--wrap">
              <button
                type="button"
                className="ui-btn ui-btn--sm ui-btn--danger"
                disabled={usuwanyId === kandydat.id}
                onClick={() => usunKandydata(kandydat.id)}
              >
                {usuwanyId === kandydat.id
                  ? t("admin.mvp.deleting")
                  : `🗑️ ${t("admin.mvp.deleteYes")}`}
              </button>

              <button
                type="button"
                className="ui-btn ui-btn--sm ui-btn--ghost"
                disabled={usuwanyId === kandydat.id}
                onClick={() => setPotwierdzanyId(null)}
              >
                {t("common.cancel")}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="ui-stack">
      <div className="ui-card ui-card--flat ui-stack ui-stack--tight">
        <h4>{t("admin.mvp.candidates")}</h4>

        {ladowanie && <Ladowanie>{t("admin.mvp.loading")}</Ladowanie>}

        {!ladowanie && kandydaci.length === 0 && (
          <p className="ui-hint">{t("admin.mvp.empty")}</p>
        )}

        {!ladowanie && kandydaci.length > 0 && aktywni.length === 0 && (
          <p className="ui-hint">{t("admin.mvp.noneOnList")}</p>
        )}

        {!ladowanie && aktywni.length > 0 && (
          <>
            <label className="ui-row">
              <input
                type="checkbox"
                checked={czyGrupaZaznaczona(aktywni)}
                onChange={() => przelaczGrupe(aktywni)}
              />

              <span className="ui-hint">
                {t("admin.mvp.selectOnList", { count: aktywni.length })}
              </span>
            </label>

            <div className="ui-stack ui-stack--tight">
              {aktywni.map(wierszKandydata)}
            </div>
          </>
        )}

        {!ladowanie && pozaLista.length > 0 && (
          <>
            <button
              type="button"
              className="ui-btn ui-btn--sm ui-btn--ghost"
              aria-expanded={pokazPozaLista}
              onClick={() => setPokazPozaLista((teraz) => !teraz)}
            >
              {pokazPozaLista ? t("admin.mvp.hide") : t("admin.mvp.show")}{" "}
              {t("admin.mvp.offListCount", { count: pozaLista.length })}
            </button>

            {pokazPozaLista && (
              <>
                <label className="ui-row">
                  <input
                    type="checkbox"
                    checked={czyGrupaZaznaczona(pozaLista)}
                    onChange={() => przelaczGrupe(pozaLista)}
                  />

                  <span className="ui-hint">
                    {t("admin.mvp.selectOffList", { count: pozaLista.length })}
                  </span>
                </label>

                <div className="ui-stack ui-stack--tight">
                  {pozaLista.map(wierszKandydata)}
                </div>
              </>
            )}
          </>
        )}

        {zaznaczone.size > 0 && (
          <div className="ui-actions">
            {potwierdzHurt ? (
              <>
                <span className="ui-note ui-note--danger">
                  {t("admin.mvp.bulkAsk", { count: zaznaczone.size })}
                </span>

                <button
                  type="button"
                  className="ui-btn ui-btn--sm ui-btn--danger"
                  disabled={kasowanieHurtowe}
                  onClick={usunZaznaczone}
                >
                  {kasowanieHurtowe
                    ? t("admin.mvp.deleting")
                    : `🗑️ ${t("admin.mvp.bulkYes")}`}
                </button>

                <button
                  type="button"
                  className="ui-btn ui-btn--sm ui-btn--ghost"
                  disabled={kasowanieHurtowe}
                  onClick={() => setPotwierdzHurt(false)}
                >
                  {t("common.cancel")}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="ui-btn ui-btn--sm ui-btn--danger"
                  onClick={() => {
                    setBlad("");
                    setKomunikat("");
                    setOdrzucone([]);
                    setPotwierdzHurt(true);
                  }}
                >
                  🗑️{" "}
                  {t("admin.mvp.bulkButton", { count: zaznaczone.size })}
                </button>

                <button
                  type="button"
                  className="ui-btn ui-btn--sm ui-btn--ghost"
                  onClick={() => setZaznaczone(new Set())}
                >
                  {t("admin.mvp.deselectAll")}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Odmowy z kasowania hurtowego. Osobno od jednego komunikatu, bo każda
          ma własny powód i własne nazwisko - zbite w jedno zdanie nie dałyby
          się przeczytać, a to jest lista rzeczy do zrobienia ręcznie. */}
      {odrzucone.length > 0 && (
        <div className="ui-card ui-card--flat ui-card--danger ui-card--tight ui-stack ui-stack--tight">
          <strong>
            {t("admin.mvp.skipped", { count: odrzucone.length })}
          </strong>

          {odrzucone.map((wpis) => (
            <span className="ui-hint" key={wpis.id}>
              {wpis.reason}
            </span>
          ))}
        </div>
      )}

      <div className="ui-card ui-card--flat ui-stack ui-stack--tight">
        <h4>{t("admin.mvp.addTitle")}</h4>

        <p className="ui-hint">
          <T
            k="admin.mvp.addHint"
            vars={{
              nick: <code>nick</code>,
              nickTeam: <code>{t("admin.mvp.addExample")}</code>,
            }}
          />
        </p>

        <textarea
          className="ui-input"
          rows={6}
          value={tekst}
          onChange={(event) => setTekst(event.target.value)}
          placeholder={"donk, Team Spirit\nm0NESY, G2"}
        />

        <div className="ui-actions">
          <button
            type="button"
            className="ui-btn ui-btn--sm ui-btn--primary"
            onClick={zapiszKandydatow}
            disabled={zapisywanie}
          >
            {zapisywanie ? t("admin.saving") : t("admin.mvp.saveButton")}
          </button>
        </div>
      </div>

      {komunikat && <p className="ui-note ui-note--ok">{komunikat}</p>}

      {blad && <p className="ui-note ui-note--danger">{blad}</p>}
    </div>
  );
}

export default MvpAdminPanel;
