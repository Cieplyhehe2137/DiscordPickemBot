import { useEffect, useState } from "react";

import Ladowanie from "../../components/Ladowanie.jsx";
import { getEventTeams, saveEventTeams } from "../../lib/api.js";
import { effectiveEventTeams } from "../../lib/eventRoster.js";
import { useConfirm } from "../ui/useConfirm.js";
import { useT } from "../../i18n/useLanguage.js";
import { toggleSelected } from "../../lib/selection.js";

// Które drużyny biorą udział W TYM turnieju.
//
// PO CO. Rolę "bierze udział w bieżącym turnieju" pełniła dotąd kolumna
// `teams.active` - jedna flaga na cały serwer Discorda. Nie da się nią opisać
// dwóch turniejów, więc przygotowanie następnego wymagało przestawienia
// bieżącego, a wyłączenie drużyny w trakcie psuło ponowny zapis typu, który
// ją zawierał. Roster turnieju (`event_teams`) to rozwiązuje, a ten panel
// jest JEDYNYM miejscem, w którym taki roster może powstać - do tej pory
// tabela była wyłącznie do czytania.
//
// PANEL OTWIERA SIĘ NA LIŚCIE, KTÓRA DZIAŁA TERAZ. Gdy turniej ma własny
// roster, zaznaczony jest ten roster. Gdy nie ma - zaznaczone są wszystkie
// aktywne drużyny serwera, bo dokładnie to oddaje dziś zapas
// (utils/loadEventTeams.js). Dzięki temu pierwszy zapis bez żadnej zmiany
// zaznaczenia NIE zmienia niczego w działaniu: te same drużyny, w tej samej
// kolejności.
//
// KOLEJNOŚĆ ZAPISU JEST ROZSTAWIENIEM. Serwer zapisuje `sort_order` jako
// pozycję w przysłanej tablicy, a cztery dropdowny wyników admina czytają
// listę właśnie po `sort_order`. Dlatego ładunek składa się ZAWSZE przez
// przefiltrowanie słownika (kolejność: sort_order, potem nazwa), nigdy przez
// przejście po zbiorze zaznaczeń - ten trzyma kolejność KLIKANIA i zapisałby
// rozstawienie wedle tego, co admin kliknął pierwsze.

function EventRosterPanel({ slug }) {
  const t = useT();
  const confirm = useConfirm();

  const [druzyny, setDruzyny] = useState([]);
  const [zaznaczone, setZaznaczone] = useState(() => new Set());
  const [maRoster, setMaRoster] = useState(false);
  const [zMeczow, setZMeczow] = useState([]);
  const [nieznaneZMeczow, setNieznaneZMeczow] = useState([]);
  const [brakTabeli, setBrakTabeli] = useState(false);

  const [zaladowane, setZaladowane] = useState(false);
  const [zapisywanie, setZapisywanie] = useState(false);
  const [komunikat, setKomunikat] = useState("");
  const [blad, setBlad] = useState("");

  useEffect(() => {
    let anulowane = false;

    (async () => {
      try {
        const dane = await getEventTeams(slug);

        if (anulowane) return;

        const lista = dane.teams ?? [];

        setDruzyny(lista);
        setMaRoster(Boolean(dane.hasRoster));
        setZMeczow(dane.matchTeamIds ?? []);
        setNieznaneZMeczow(dane.unknownMatchNames ?? []);
        setBrakTabeli(Boolean(dane.tableMissing));

        // Panel ma pokazać stan, który obowiązuje w tej chwili, a nie puste
        // zaznaczenie do wypełnienia. Regułę zapasu trzyma jeden plik, bo
        // potrzebuje jej też formularz meczu - patrz lib/eventRoster.js.
        setZaznaczone(new Set(effectiveEventTeams(dane).map((d) => d.id)));

        setBlad("");
      } catch (err) {
        console.error("EVENT ROSTER LOAD:", err);

        if (!anulowane) {
          setBlad(err.message || t("admin.roster.loadError"));
        }
      } finally {
        if (!anulowane) setZaladowane(true);
      }
    })();

    return () => {
      anulowane = true;
    };
  }, [slug, t]);

  const aktywne = druzyny.filter((d) => d.active).map((d) => d.id);

  function przelacz(id) {
    setKomunikat("");
    setZaznaczone((biezace) => toggleSelected(biezace, id));
  }

  function zaznaczZbior(ids) {
    setKomunikat("");
    setZaznaczone(new Set(ids));
  }

  // Jedyne miejsce, które składa ładunek - patrz uwaga o kolejności u góry.
  function wybraneWKolejnosciSlownika() {
    return druzyny.filter((d) => zaznaczone.has(d.id)).map((d) => d.id);
  }

  async function zapisz() {
    const teamIds = wybraneWKolejnosciSlownika();

    // Pusta lista to KASOWANIE rostera, nie zapis pustego - w bazie to ten
    // sam stan, więc nie da się tych dwóch rozdzielić i trzeba o to zapytać.
    if (!teamIds.length) {
      const potwierdzone = await confirm({
        title: t("admin.roster.clearTitle"),
        description: t("admin.roster.clearText"),
        confirmLabel: t("admin.roster.clearButton"),
      });

      if (!potwierdzone) return;
    }

    setZapisywanie(true);
    setBlad("");
    setKomunikat("");

    try {
      const odpowiedz = await saveEventTeams(slug, teamIds);

      setMaRoster(!odpowiedz.cleared);

      setKomunikat(
        odpowiedz.cleared
          ? t("admin.roster.cleared")
          : t("admin.roster.saved", { count: odpowiedz.saved }),
      );
    } catch (err) {
      setBlad(err.message || t("admin.roster.saveError"));
    } finally {
      setZapisywanie(false);
    }
  }

  if (!zaladowane) {
    return <Ladowanie>{t("admin.roster.loading")}</Ladowanie>;
  }

  return (
    <div className="ui-stack">
      <p className="ui-hint">{t("admin.roster.hint")}</p>

      {/* Stan faktyczny, nie zaznaczenie: skąd bierze się dziś lista drużyn
          w formularzach faz i w dropdownach bota. */}
      <p className="ui-note">
        {maRoster
          ? t("admin.roster.own", { count: zaznaczone.size })
          : t("admin.roster.fallback", { count: aktywne.length })}
      </p>

      {/* Migracja 0014 mogła jeszcze nie pójść. Odczyt to znosi (schodzi na
          roster serwera), ale zapis nie ma gdzie trafić. */}
      {brakTabeli && (
        <p className="ui-note ui-note--warn">
          ⚠️ {t("admin.roster.tableMissing")}
        </p>
      )}

      {/* Mecze trzymają nazwy tekstowe, więc nazwa z meczu bez wiersza
          w słowniku serwera nie da się zaznaczyć - trzeba ją wymienić, żeby
          nie wyglądało to na zgubioną drużynę. */}
      {nieznaneZMeczow.length > 0 && (
        <p className="ui-note ui-note--warn">
          {t("admin.roster.unknownNames", {
            names: nieznaneZMeczow.join(", "),
          })}
        </p>
      )}

      {druzyny.length === 0 ? (
        <p className="ui-note ui-note--warn">{t("admin.roster.empty")}</p>
      ) : (
        <>
          <div className="ui-row ui-row--wrap">
            <button
              type="button"
              onClick={() => zaznaczZbior(aktywne)}
              disabled={zapisywanie}
            >
              {t("admin.roster.pickActive")}
            </button>

            {/* Skrót dla turniejów, które już się odbyły: ich prawdziwa lista
                uczestników przetrwała w meczach, a roster serwera zdążył
                odjechać. Bez tego wskazanie rostera archiwalnemu turniejowi
                to przeklikanie całego słownika z pamięci. */}
            {zMeczow.length > 0 && (
              <button
                type="button"
                onClick={() => zaznaczZbior(zMeczow)}
                disabled={zapisywanie}
              >
                {t("admin.roster.pickFromMatches", { count: zMeczow.length })}
              </button>
            )}

            <button
              type="button"
              onClick={() => zaznaczZbior([])}
              disabled={zapisywanie}
            >
              {t("admin.roster.pickNone")}
            </button>
          </div>

          <div className="ui-stack ui-stack--tight">
            {druzyny.map((druzyna) => (
              <label className="ui-row" key={druzyna.id}>
                <input
                  type="checkbox"
                  checked={zaznaczone.has(druzyna.id)}
                  disabled={zapisywanie}
                  onChange={() => przelacz(druzyna.id)}
                />

                <span>{druzyna.name}</span>

                {/* Drużyna wyłączona na serwerze zostaje na liście: wyłączenie
                    po turnieju nie może jej usunąć z turnieju, w którym
                    zagrała - to jest cały powód istnienia tego rostera. */}
                {!druzyna.active && (
                  <span className="ui-hint">{t("admin.roster.inactive")}</span>
                )}
              </label>
            ))}
          </div>

          <p className="ui-hint">
            {t("admin.roster.selected", { count: zaznaczone.size })}
          </p>

          <button
            type="button"
            onClick={zapisz}
            disabled={zapisywanie || brakTabeli}
          >
            {zapisywanie ? t("admin.saving") : t("admin.roster.save")}
          </button>
        </>
      )}

      {komunikat && <p className="ui-note ui-note--ok">{komunikat}</p>}

      {blad && <p className="ui-note ui-note--danger">{blad}</p>}
    </div>
  );
}

export default EventRosterPanel;
