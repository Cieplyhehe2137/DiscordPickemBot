import { Link } from "react-router-dom";
import { useAuth } from "../auth/useAuth.js";
import { useConfirm } from "../components/ui/useConfirm.js";
import { T } from "../i18n/T.jsx";
import { useLanguage } from "../i18n/useLanguage.js";
import { useEffect, useState } from "react";
import {
  createAdminEvent,
  createAdminMatch,
  createAdminTeam,
  getAdminEvents,
  getAdminMatches,
  getAdminServers,
  getAdminTeams,
  getEventLeaderboard,
  getAdminDeadline,
  updateAdminTeam,
  deleteAdminTeam,
  setAdminDeadline,
  clearAdminDeadline,
  setAdminEventPhase,
  setAdminEventStatus,
  setAdminMatchLockMode,
  setAdminMatchStart,
  updateAdminMatch,
  getAdminMatchDeletePreview,
  deleteAdminMatch,
} from "../lib/api.js";
import { adminGuildIds } from "../lib/permissions.js";
import PhaseResultsAdmin from "../components/admin/PhaseResultsAdmin.jsx";
import MvpAdminPanel from "../components/admin/MvpAdminPanel.jsx";
import TournamentOpsPanel from "../components/admin/TournamentOpsPanel.jsx";
import StartPickemPanel from "../components/admin/StartPickemPanel.jsx";
import PickemConfigPanel from "../components/admin/PickemConfigPanel.jsx";
import Ladowanie from "../components/Ladowanie.jsx";
import LoginRequired from "../components/LoginRequired.jsx";
// Ton plakietki statusu meczu. Wczesniej nazwa klasy powstawala ze sklejenia
// "admin-badge--status-" i statusu z API - czyli CSS musial znac z gory kazda
// wartosc, jaka backend kiedykolwiek zwroci, a literowka byla niewidoczna.
// Nagłówki kolumn klasyfikacji. Ta sama lista trafia do nagłówka tabeli i -
// przez data-label na komórkach - do podpisów na telefonie, więc nie da się
// ich rozjechać.
const KOLUMNY_KLASYFIKACJI = [
  "adminPage.column.place",
  "adminPage.column.player",
  "adminPage.column.points",
  "adminPage.column.series",
  "adminPage.column.maps",
  "adminPage.column.picks",
  "adminPage.column.hits",
  "adminPage.column.mapHits",
  "adminPage.column.exacts",
  "adminPage.column.accuracy",
];

// Klasa czołówki. Tablica, a nie sklejanie `ui-datatable__row--${rank}`:
// przy sklejaniu nazwa nie występuje w kodzie dosłownie, więc czyszczenie
// martwego CSS jej nie widzi. Dokładnie tak zniknęło poprzednie wyróżnienie
// pierwszej trójki w tej tabeli.
const PODIUM_KLASYFIKACJI = {
  1: " ui-datatable__row--1",
  2: " ui-datatable__row--2",
  3: " ui-datatable__row--3",
};

const TON_STATUSU = {
  OPEN: "ui-badge--ok",
  LOCKED: "ui-badge--danger",
  FINAL: "",
};

// Tryb blokady meczu. Klucz to lock_override: 1 wymusza zamknięcie, 0 wymusza
// otwarcie, brak wartości zostawia decyzję zegarowi.
//
// Ton szedł wcześniej ze sklejanki `ui-badge--${...}` dającej ui-badge--lock,
// ui-badge--unlock i ui-badge--auto. Żadna z tych trzech klas nie istnieje
// w CSS, więc wszystkie trzy tryby wyglądały identycznie - plakietka mówiła
// LOCK albo UNLOCK tym samym szarym kolorem. Ta sama pułapka co zawsze:
// nazwa sklejona ze zmiennej nie występuje w źródle dosłownie.
const TON_BLOKADY = {
  1: "ui-badge--danger",
  0: "ui-badge--ok",
};

const ETYKIETA_BLOKADY = {
  1: "LOCK",
  0: "UNLOCK",
};

export default function AdminPage() {
  const { jezyk, t } = useLanguage();

  const { user, canAccessAdmin, authLoading } = useAuth();

  // Pytanie "na pewno?" własnym oknem zamiast window.confirm - powody
  // w components/ui/ConfirmProvider.jsx.
  const confirm = useConfirm();

  const [servers, setServers] = useState([]);
  const [loadingServers, setLoadingServers] = useState(true);
  const [serversError, setServersError] = useState("");
  const [selectedServer, setSelectedServer] = useState(null);
  const [serverEventsStan, setServerEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [eventsError, setEventsError] = useState("");
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [activeAdminSection, setActiveAdminSection] = useState(null);
  const [changingStatus, setChangingStatus] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const [changingPhase, setChangingPhase] = useState(false);
  const [phaseMessage, setPhaseMessage] = useState(null);
  const [newEventName, setNewEventName] = useState("");
  const [newEventSlug, setNewEventSlug] = useState("");
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [createEventMessage, setCreateEventMessage] = useState(null);
  const [newMatchPhase, setNewMatchPhase] = useState("SWISS");
  const [newMatchTeamA, setNewMatchTeamA] = useState("");
  const [newMatchTeamB, setNewMatchTeamB] = useState("");
  const [newMatchBestOf, setNewMatchBestOf] = useState("3");
  const [newMatchStartTime, setNewMatchStartTime] = useState("");
  const [creatingMatch, setCreatingMatch] = useState(false);
  const [createMatchMessage, setCreateMatchMessage] = useState(null);
  const [adminTeamsStan, setAdminTeams] = useState([]);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [teamsError, setTeamsError] = useState("");
  const [deadlinePhase, setDeadlinePhase] = useState("swiss");
  const [deadlineStage, setDeadlineStage] = useState("1");
  const [deadlineValue, setDeadlineValue] = useState("");
  const [savingDeadline, setSavingDeadline] = useState(false);
  const [deadlineMessage, setDeadlineMessage] = useState("");

  // Czy ostatni komunikat o terminie to sukces. Osobno od jego treści -
  // patrz komentarz przy plakietce niżej.
  const [deadlineUdane, setDeadlineUdane] = useState(false);
  const [adminMatchesStan, setAdminMatches] = useState([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [matchesError, setMatchesError] = useState("");
  const [editingMatchStartId, setEditingMatchStartId] = useState(null);
  const [editingMatchStartValue, setEditingMatchStartValue] = useState("");
  const [savingMatchStart, setSavingMatchStart] = useState(false);
  const [lockingMatchId, setLockingMatchId] = useState(null);
  const [editingMatchId, setEditingMatchId] = useState(null);
  const [editingMatchTeamA, setEditingMatchTeamA] = useState("");
  const [editingMatchTeamB, setEditingMatchTeamB] = useState("");
  const [editingMatchBestOf, setEditingMatchBestOf] = useState("3");
  const [savingMatchEdit, setSavingMatchEdit] = useState(false);
  const [deletingMatchId, setDeletingMatchId] = useState(null);
  const [matchDeletePreview, setMatchDeletePreview] = useState(null);
  const [loadingMatchDeletePreview, setLoadingMatchDeletePreview] =
    useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [createTeamMessage, setCreateTeamMessage] = useState("");
  const [editingTeamId, setEditingTeamId] = useState(null);
  const [editingTeamName, setEditingTeamName] = useState("");
  const [savingTeamEdit, setSavingTeamEdit] = useState(false);
  const [teamEditMessage, setTeamEditMessage] = useState(null);
  const [deletingTeamId, setDeletingTeamId] = useState(null);
  const [teamDeleteMessage, setTeamDeleteMessage] = useState(null);
  const [togglingTeamId, setTogglingTeamId] = useState(null);
  const [eventLeaderboardStan, setEventLeaderboard] = useState([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [leaderboardErrorStan, setLeaderboardError] = useState("");

  // Ta sama reguła co w navbarze: administrator serwera, który bot
  // obsługuje. Wylicza to /api/auth/me, więc front nie ma tu własnej kopii
  // porównywania bitmaski - a ktoś, kto wejdzie na /admin ręcznie, widzi
  // "brak uprawnień" zamiast pustej listy serwerów.
  const isAdmin = canAccessAdmin;

  const guildIds = adminGuildIds(user);

  const adminServers = servers.filter((server) =>
    guildIds.has(String(server.guild_id)),
  );

  // Jeden komunikat na wszystkie akcje na meczach - kazda akcja zaczyna od
  // wyczyszczenia go, wiec admin widzi zawsze wynik tego, co wlasnie zrobil,
  // a nie stos starych potwierdzen.
  const [matchActionMessage, setMatchActionMessage] = useState(null);

  // Gdy nic nie jest wybrane, po prostu nie mamy co pokazac. Wyliczamy to
  // przy renderze zamiast zerowac stan w ciele efektu - takie setState
  // wywoluje dodatkowy przebieg renderowania.
  const serverEvents = selectedServer ? serverEventsStan : [];
  const adminTeams = selectedServer ? adminTeamsStan : [];
  const adminMatches = selectedEvent ? adminMatchesStan : [];
  const eventLeaderboard = selectedEvent ? eventLeaderboardStan : [];
  const leaderboardError = selectedEvent ? leaderboardErrorStan : "";

  useEffect(() => {
    if (authLoading || !user || !isAdmin) {
      return;
    }

    async function loadServers() {
      try {
        setServersError("");

        const data = await getAdminServers();

        setServers(data.servers ?? []);
      } catch (err) {
        setServersError(err.message || t("adminPage.serversError"));
      } finally {
        setLoadingServers(false);
      }
    }

    loadServers();
  }, [authLoading, user, isAdmin, t]);

  useEffect(() => {
    if (!selectedServer) return;

    async function loadServerEvents() {
      try {
        setLoadingEvents(true);
        setEventsError("");
        setSelectedEvent(null);
        setActiveAdminSection(null);
        setCreateMatchMessage(null);

        const data = await getAdminEvents(selectedServer.guild_id);

        setServerEvents(data.events ?? []);
      } catch (err) {
        setEventsError(err.message || t("adminPage.eventsError"));
        setServerEvents([]);
      } finally {
        setLoadingEvents(false);
      }
    }

    loadServerEvents();
  }, [selectedServer, t]);

  useEffect(() => {
    if (!selectedServer) return;

    async function loadAdminTeams() {
      try {
        setLoadingTeams(true);
        setTeamsError("");

        const data = await getAdminTeams(selectedServer.guild_id);

        setAdminTeams(data.teams ?? []);
      } catch (err) {
        setTeamsError(err.message || t("adminPage.teams.loadError"));

        setAdminTeams([]);
      } finally {
        setLoadingTeams(false);
      }
    }

    loadAdminTeams();
  }, [selectedServer, t]);

  useEffect(() => {
    if (!selectedEvent) return;

    async function loadAdminMatches() {
      try {
        setLoadingMatches(true);
        setMatchesError("");

        const data = await getAdminMatches(selectedEvent.slug);

        setAdminMatches(data.matches ?? []);
      } catch (err) {
        setMatchesError(err.message || t("adminPage.matches.loadError"));

        setAdminMatches([]);
      } finally {
        setLoadingMatches(false);
      }
    }

    loadAdminMatches();
  }, [selectedEvent, t]);

  useEffect(() => {
    if (!selectedEvent) return;

    async function loadEventLeaderboard() {
      try {
        setLoadingLeaderboard(true);
        setLeaderboardError("");

        const data = await getEventLeaderboard(selectedEvent.slug);

        setEventLeaderboard(data.leaderboard ?? []);
      } catch (err) {
        setLeaderboardError(
          err.message || t("adminPage.leaderboard.error"),
        );

        setEventLeaderboard([]);
      } finally {
        setLoadingLeaderboard(false);
      }
    }

    loadEventLeaderboard();
  }, [selectedEvent, t]);

  useEffect(() => {
    if (!selectedServer || !activeAdminSection) {
      return;
    }

    if (activeAdminSection !== "locks") {
      return;
    }

    async function loadDeadline() {
      try {
        setDeadlineMessage("");

        const data = await getAdminDeadline(
          selectedServer.guild_id,
          deadlinePhase,
          deadlinePhase === "swiss" ? deadlineStage : null,
        );

        if (!data.deadline) {
          setDeadlineValue("");
          return;
        }

        const date = new Date(data.deadline);

        const localValue = new Date(
          date.getTime() - date.getTimezoneOffset() * 60000,
        )
          .toISOString()
          .slice(0, 16);
        setDeadlineValue(localValue);
      } catch (err) {
        console.error("ADMIN DEADLINE LOAD:", err);

        setDeadlineValue("");
      }
    }

    loadDeadline();
  }, [selectedServer, activeAdminSection, deadlinePhase, deadlineStage]);

  async function handleEventStatusChange(status) {
    if (!selectedEvent) {
      return;
    }

    if (status === "ARCHIVED") {
      const confirmed = await confirm({
        title: t("adminPage.event.archiveAsk"),
        description: t("adminPage.event.archiveText", {
          name: selectedEvent.name,
        }),
        confirmLabel: t("adminPage.event.archive"),
      });

      if (!confirmed) {
        return;
      }
    }

    try {
      setChangingStatus(true);
      setStatusMessage(null);

      const data = await setAdminEventStatus(selectedEvent.slug, status);

      setSelectedEvent((current) => ({
        ...current,
        status: data.status,
        is_archived: data.is_archived,
      }));

      setServerEvents((current) =>
        current.map((event) =>
          event.id === selectedEvent.id
            ? {
                ...event,
                status: data.status,
                is_archived: data.is_archived,
              }
            : event,
        ),
      );

      setStatusMessage({ text: t("adminPage.event.statusChanged"), ok: true });
    } catch (err) {
      setStatusMessage({
        text: err.message || t("adminPage.event.statusError"),
        ok: false,
      });
    } finally {
      setChangingStatus(false);
    }
  }

  async function handleEventPhaseChange(phase) {
    if (!selectedEvent) {
      return;
    }

    try {
      setChangingPhase(true);
      setPhaseMessage(null);

      const data = await setAdminEventPhase(selectedEvent.slug, phase);

      setSelectedEvent((current) => ({
        ...current,
        phase: data.phase,
      }));

      setServerEvents((current) =>
        current.map((event) =>
          event.id === selectedEvent.id
            ? {
                ...event,
                phase: data.phase,
              }
            : event,
        ),
      );

      setPhaseMessage({ text: t("adminPage.event.phaseChanged"), ok: true });
    } catch (err) {
      setPhaseMessage({
        text: err.message || t("adminPage.event.phaseError"),
        ok: false,
      });
    } finally {
      setChangingPhase(false);
    }
  }

  async function handleCreateEvent(event) {
    event.preventDefault();

    if (!selectedServer) {
      return;
    }

    try {
      setCreatingEvent(true);
      setCreateEventMessage(null);

      const data = await createAdminEvent(selectedServer.guild_id, {
        name: newEventName.trim(),
        slug: newEventSlug.trim(),
      });

      setServerEvents((current) => [data.event, ...current]);

      setSelectedEvent(data.event);

      setNewEventName("");
      setNewEventSlug("");

      setCreateEventMessage({ text: t("adminPage.newEvent.created"), ok: true });
    } catch (err) {
      setCreateEventMessage({
        text: err.message || t("adminPage.newEvent.error"),
        ok: false,
      });
    } finally {
      setCreatingEvent(false);
    }
  }

  async function handleSaveMatchStart(matchId, forcedValue = null) {
    try {
      setSavingMatchStart(true);
      setMatchActionMessage(null);

      const value = forcedValue !== null ? forcedValue : editingMatchStartValue;

      const startTimeUtc = value ? new Date(value).toISOString() : null;

      await setAdminMatchStart(matchId, startTimeUtc);

      const matchesData = await getAdminMatches(selectedEvent.slug);

      setAdminMatches(matchesData.matches ?? []);

      setEditingMatchStartId(null);
      setEditingMatchStartValue("");

      setMatchActionMessage({
        tekst: startTimeUtc
          ? t("adminPage.matches.startSaved")
          : t("adminPage.matches.startDeleted"),
        ok: true,
      });
    } catch (err) {
      setMatchActionMessage({
        tekst: err.message || t("adminPage.matches.startError"),
        ok: false,
      });
    } finally {
      setSavingMatchStart(false);
    }
  }

  if (authLoading) {
    return (
      <div className="ui-page">
        <p>{t("adminResult.checking")}</p>
      </div>
    );
  }

  async function handleCreateTeam(event) {
    event.preventDefault();

    if (!selectedServer || !newTeamName.trim()) {
      return;
    }

    try {
      setCreatingTeam(true);
      setCreateTeamMessage("");

      await createAdminTeam(selectedServer.guild_id, {
        name: newTeamName.trim(),
        shortName: null,
      });

      const teamsData = await getAdminTeams(selectedServer.guild_id);

      setAdminTeams(teamsData.teams ?? []);
      setNewTeamName("");

      setCreateTeamMessage(t("adminPage.teams.added"));
    } catch (err) {
      setCreateTeamMessage(err.message || t("adminPage.teams.addError"));
    } finally {
      setCreatingTeam(false);
    }
  }

  async function handleSaveTeamEdit(teamId) {
    if (!selectedServer || !editingTeamName.trim()) {
      return;
    }

    try {
      setSavingTeamEdit(true);
      setTeamEditMessage(null);

      await updateAdminTeam(selectedServer.guild_id, teamId, {
        name: editingTeamName.trim(),
      });

      const teamsData = await getAdminTeams(selectedServer.guild_id);

      setAdminTeams(teamsData.teams ?? []);

      setEditingTeamId(null);
      setEditingTeamName("");

      setTeamEditMessage({
        text: t("adminPage.teams.updated"),
        ok: true,
      });
    } catch (err) {
      setTeamEditMessage({
        text: err.message || t("adminPage.teams.updateError"),
        ok: false,
      });
    } finally {
      setSavingTeamEdit(false);
    }
  }

  async function handleDeleteTeam(team) {
    if (!selectedServer) {
      return;
    }

    const confirmed = await confirm({
      title: t("adminPage.teams.deleteAsk"),
      description: t("adminPage.teams.deleteText", { name: team.name }),
      confirmLabel: t("adminPage.teams.deleteButton"),
      tone: "danger",
    });

    if (!confirmed) {
      return;
    }

    try {
      setDeletingTeamId(team.id);
      setTeamDeleteMessage(null);

      await deleteAdminTeam(selectedServer.guild_id, team.id);

      const teamsData = await getAdminTeams(selectedServer.guild_id);

      setAdminTeams(teamsData.teams ?? []);

      setTeamDeleteMessage({ text: t("adminPage.teams.deleted"), ok: true });
    } catch (err) {
      setTeamDeleteMessage({
        text: err.message || t("adminPage.teams.deleteError"),
        ok: false,
      });
    } finally {
      setDeletingTeamId(null);
    }
  }

  async function handleToggleTeamActive(team) {
    if (!selectedServer) {
      return;
    }

    try {
      setTogglingTeamId(team.id);
      setTeamEditMessage(null);

      await updateAdminTeam(selectedServer.guild_id, team.id, {
        active: !team.active,
      });

      const teamsData = await getAdminTeams(selectedServer.guild_id);

      setAdminTeams(teamsData.teams ?? []);

      setTeamEditMessage(
        team.active
          ? { text: t("adminPage.teams.deactivated"), ok: true }
          : { text: t("adminPage.teams.activated"), ok: true },
      );
    } catch (err) {
      setTeamEditMessage({
        text: err.message || t("adminPage.teams.toggleError"),
        ok: false,
      });
    } finally {
      setTogglingTeamId(null);
    }
  }

  async function handleCreateMatch(event) {
    event.preventDefault();

    if (!selectedServer || !selectedEvent) {
      return;
    }

    try {
      setCreatingMatch(true);
      setCreateMatchMessage(null);

      await createAdminMatch(selectedServer.guild_id, selectedEvent.slug, {
        phase: newMatchPhase,
        teamA: newMatchTeamA,
        teamB: newMatchTeamB,
        bestOf: Number(newMatchBestOf),
        startTimeUtc: newMatchStartTime || null,
      });

      const matchesData = await getAdminMatches(selectedEvent.slug);

      setAdminMatches(matchesData.matches ?? []);

      setNewMatchTeamA("");
      setNewMatchTeamB("");
      setNewMatchStartTime("");

      setCreateMatchMessage({ text: t("adminPage.matches.created"), ok: true });
    } catch (err) {
      setCreateMatchMessage({
        text: err.message || t("adminPage.matches.createError"),
        ok: false,
      });
    } finally {
      setCreatingMatch(false);
    }
  }

  async function handleSaveDeadline(event) {
    event.preventDefault();

    if (!selectedServer || !deadlineValue) {
      return;
    }

    try {
      setSavingDeadline(true);
      setDeadlineMessage("");

      const payload = {
        phase: deadlinePhase,
        data: deadlineValue.replace("T", " "),
      };

      if (deadlinePhase === "swiss") {
        payload.stage = deadlineStage;
      }

      await setAdminDeadline(selectedServer.guild_id, payload);

      setDeadlineUdane(true);
      setDeadlineMessage(t("adminPage.locks.saved"));
    } catch (err) {
      setDeadlineUdane(false);

      if (err.message?.includes("No active panel found")) {
        setDeadlineMessage(t("adminPage.locks.noPanel"));
      } else {
        setDeadlineMessage(err.message || t("adminPage.locks.saveError"));
      }
    } finally {
      setSavingDeadline(false);
    }
  }

  async function handleClearDeadline() {
    if (!selectedServer) {
      return;
    }

    const confirmed = await confirm({
      title: t("adminPage.locks.clearAsk"),
      description: t("adminPage.locks.clearText"),
      confirmLabel: t("adminPage.locks.clearButton"),
    });

    if (!confirmed) {
      return;
    }

    try {
      setSavingDeadline(true);
      setDeadlineMessage("");

      const payload = {
        phase: deadlinePhase,
      };

      if (deadlinePhase === "swiss") {
        payload.stage = deadlineStage;
      }

      await clearAdminDeadline(selectedServer.guild_id, payload);

      setDeadlineValue("");
      setDeadlineUdane(true);
      setDeadlineMessage(t("adminPage.locks.cleared"));
    } catch (err) {
      setDeadlineUdane(false);
      setDeadlineMessage(err.message || t("adminPage.locks.clearError"));
    } finally {
      setSavingDeadline(false);
    }
  }

  async function handleSetMatchLockMode(match, mode) {
    try {
      setLockingMatchId(match.id);
      setMatchActionMessage(null);

      await setAdminMatchLockMode(match.id, mode);

      const matchesData = await getAdminMatches(selectedEvent.slug);

      setAdminMatches(matchesData.matches ?? []);

      const opis = {
        lock: t("adminPage.matches.locked"),
        unlock: t("adminPage.matches.unlocked"),
        auto: t("adminPage.matches.auto"),
      };

      if (opis[mode]) {
        setMatchActionMessage({ tekst: opis[mode], ok: true });
      }
    } catch (err) {
      setMatchActionMessage({
        tekst: err.message || t("adminPage.matches.lockError"),
        ok: false,
      });
    } finally {
      setLockingMatchId(null);
    }
  }

  async function handleSaveMatchEdit(matchId) {
    try {
      setSavingMatchEdit(true);
      setMatchActionMessage(null);

      await updateAdminMatch(matchId, {
        teamA: editingMatchTeamA,
        teamB: editingMatchTeamB,
        bestOf: Number(editingMatchBestOf),
      });

      const matchesData = await getAdminMatches(selectedEvent.slug);

      setAdminMatches(matchesData.matches ?? []);

      setEditingMatchId(null);

      setMatchActionMessage({
        tekst: t("adminPage.matches.editSaved"),
        ok: true,
      });
    } catch (err) {
      setMatchActionMessage({
        tekst: err.message || t("adminPage.matches.editError"),
        ok: false,
      });
    } finally {
      setSavingMatchEdit(false);
    }
  }

  async function handleOpenDeleteMatch(matchId) {
    try {
      setLoadingMatchDeletePreview(true);
      setDeletingMatchId(matchId);
      setMatchActionMessage(null);

      const preview = await getAdminMatchDeletePreview(matchId);

      setDeletingMatchId(matchId);
      setMatchDeletePreview(preview);
    } catch (err) {
      setMatchActionMessage({
        tekst: err.message || t("adminPage.matches.deletePreviewError"),
        ok: false,
      });
    } finally {
      setLoadingMatchDeletePreview(false);
    }
  }

  async function handleDeleteMatch(matchId) {
    try {
      setMatchActionMessage(null);

      await deleteAdminMatch(matchId);

      const matchesData = await getAdminMatches(selectedEvent.slug);

      setAdminMatches(matchesData.matches ?? []);

      setDeletingMatchId(null);
      setMatchDeletePreview(null);

      setMatchActionMessage({ tekst: t("adminPage.matches.deleted"), ok: true });
    } catch (err) {
      setMatchActionMessage({
        tekst: err.message || t("adminPage.matches.deleteError"),
        ok: false,
      });
    }
  }

  if (!user) {
    return (
      <div className="ui-page">
        <LoginRequired>{t("adminPage.loginText")}</LoginRequired>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="ui-page">
        <div className="ui-empty">
          <span className="ui-empty__icon" aria-hidden="true">
            🚫
          </span>

          <strong className="ui-empty__title">
            {t("adminPage.noAccess")}
          </strong>

          <p className="ui-empty__text">{t("adminPage.noAccessText")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ui-page">
      <div className="ui-section-head">
        <div>
          <span className="ui-kicker">⚙️ {t("adminPage.kicker")}</span>

          <h2>{t("adminPage.title")}</h2>

          <p>{t("adminPage.intro")}</p>
        </div>
      </div>
      <section className="ui-card ui-stack">
        <h2>{t("adminPage.servers")}</h2>
        {loadingServers && (
          <Ladowanie>{t("adminPage.loadingServers")}</Ladowanie>
        )}
        {serversError && <p>{serversError}</p>}
        {!loadingServers && !serversError && adminServers.length === 0 && (
          <p>{t("adminPage.noServers")}</p>
        )}
        {!loadingServers &&
          adminServers.map((server) => (
            <button
              key={server.guild_id}
              type="button"
              className="ui-choice__option ui-choice__option--stacked"
              aria-pressed={selectedServer?.guild_id === server.guild_id}
              onClick={() => setSelectedServer(server)}
            >
              {" "}
              <strong>{server.name}</strong>{" "}
              <span>
                {" "}
                {t("adminPage.eventsCount", {
                  count: server.events_count ?? 0,
                })}
              </span>{" "}
            </button>
          ))}{" "}
      </section>{" "}
      {selectedServer && (
        <section className="ui-card ui-stack">
          {" "}
          <h2>{t("adminPage.events")}</h2>{" "}
          {loadingEvents && (
            <Ladowanie>{t("adminPage.loadingEvents")}</Ladowanie>
          )}{" "}
          {eventsError && <p>{eventsError}</p>}{" "}
          {!loadingEvents && !eventsError && serverEvents.length === 0 && (
            <p>{t("adminPage.noEvents")}</p>
          )}{" "}
          {!loadingEvents &&
            serverEvents.map((event) => (
              <button
                key={event.id}
                type="button"
                className="ui-choice__option ui-choice__option--stacked"
                aria-pressed={selectedEvent?.id === event.id}
                onClick={() => setSelectedEvent(event)}
              >
                {" "}
                <strong>{event.name}</strong>{" "}
                <span>
                  {" "}
                  {event.phase} · {event.status}{" "}
                </span>{" "}
              </button>
            ))}{" "}
        </section>
      )}{" "}
      <div className="ui-tiles">
        {" "}
        <button
          type="button"
          className={`ui-card ui-card--interactive ui-tile ${activeAdminSection === "events" ? "ui-card--selected" : ""}`}
          disabled={!selectedEvent}
          onClick={() => setActiveAdminSection("events")}
        >
          {" "}
          <span>🏆 {t("adminPage.events")}</span>{" "}
          <strong>{t("adminPage.tile.events")}</strong>{" "}
          <p>
            {" "}
            {selectedEvent
              ? t("adminPage.tile.selected", { name: selectedEvent.name })
              : t("adminPage.tile.pickFirst")}{" "}
          </p>{" "}
        </button>{" "}
        <button
          type="button"
          className={`ui-card ui-card--interactive ui-tile ${activeAdminSection === "matches" ? "ui-card--selected" : ""}`}
          disabled={!selectedEvent}
          onClick={() => setActiveAdminSection("matches")}
        >
          {" "}
          <span>🎯 {t("home.stats.matches")}</span>{" "}
          <strong>{t("adminPage.tile.matches")}</strong>{" "}
          <p>
            {" "}
            {selectedEvent
              ? t("adminPage.tile.selected", { name: selectedEvent.name })
              : t("adminPage.tile.pickFirst")}{" "}
          </p>{" "}
        </button>{" "}
        <button
          type="button"
          className={`ui-card ui-card--interactive ui-tile ${activeAdminSection === "locks" ? "ui-card--selected" : ""}`}
          disabled={!selectedEvent}
          onClick={() => setActiveAdminSection("locks")}
        >
          {" "}
          <span>🔒 {t("adminPage.tile.picking")}</span>{" "}
          <strong>{t("adminPage.tile.locks")}</strong>{" "}
          <p>
            {" "}
            {selectedEvent
              ? t("adminPage.tile.selected", { name: selectedEvent.name })
              : t("adminPage.tile.pickFirst")}{" "}
          </p>{" "}
        </button>{" "}
        <button
          type="button"
          className="ui-card ui-card--interactive ui-tile"
          disabled={!selectedEvent}
          onClick={() => setActiveAdminSection("results")}
        >
          {" "}
          <span>📊 {t("adminPage.tile.results")}</span>{" "}
          <strong>{t("adminPage.tile.resultsName")}</strong>{" "}
          <p>{t("adminPage.tile.resultsHint")}</p>{" "}
        </button>{" "}
        <button
          type="button"
          className={`ui-card ui-card--interactive ui-tile ${activeAdminSection === "phases" ? "ui-card--selected" : ""}`}
          disabled={!selectedEvent}
          onClick={() => setActiveAdminSection("phases")}
        >
          {" "}
          <span>🏁 {t("adminPage.tile.phases")}</span>{" "}
          <strong>Swiss / Playoffs / Play-In / DE</strong>{" "}
          <p>{t("adminPage.tile.phasesHint")}</p>{" "}
        </button>{" "}
        <button
          type="button"
          className={`ui-card ui-card--interactive ui-tile ${activeAdminSection === "pickemcfg" ? "ui-card--selected" : ""}`}
          disabled={!selectedEvent}
          onClick={() => setActiveAdminSection("pickemcfg")}
        >
          {" "}
          <span>🧩 {t("adminPage.tile.pickemcfg")}</span>{" "}
          <strong>{t("adminPage.tile.pickemcfgName")}</strong>{" "}
          <p>{t("adminPage.tile.pickemcfgHint")}</p>{" "}
        </button>{" "}
        <button
          type="button"
          className={`ui-card ui-card--interactive ui-tile ${activeAdminSection === "mvp" ? "ui-card--selected" : ""}`}
          disabled={!selectedEvent}
          onClick={() => setActiveAdminSection("mvp")}
        >
          {" "}
          <span>⭐ MVP</span>{" "}
          <strong>{t("adminPage.tile.mvpName")}</strong>{" "}
          <p>{t("adminPage.tile.mvpHint")}</p>{" "}
        </button>{" "}
        <button
          type="button"
          className={`ui-card ui-card--interactive ui-tile ${activeAdminSection === "ops" ? "ui-card--selected" : ""}`}
          disabled={!selectedEvent}
          onClick={() => setActiveAdminSection("ops")}
        >
          {" "}
          <span>🛠️ {t("adminPage.tile.ops")}</span>{" "}
          <strong>{t("adminPage.tile.opsName")}</strong>{" "}
          <p>{t("adminPage.tile.opsHint")}</p>{" "}
        </button>{" "}
        <button
          type="button"
          className={`ui-card ui-card--interactive ui-tile ${activeAdminSection === "teams" ? "ui-card--selected" : ""}`}
          disabled={!selectedServer}
          onClick={() => setActiveAdminSection("teams")}
        >
          {" "}
          <span>👥 {t("adminPage.tile.teams")}</span>{" "}
          <strong>{t("adminPage.tile.teamsName")}</strong>{" "}
          <p>{t("adminPage.tile.teamsHint")}</p>{" "}
        </button>{" "}
      </div>{" "}
      {activeAdminSection === "events" && selectedEvent && (
        <section className="ui-card ui-stack">
          {" "}
          <h2>{t("adminPage.event.title")}</h2>{" "}
          <p>
            <T
              k="adminPage.event.editing"
              vars={{ name: <strong>{selectedEvent.name}</strong> }}
            />
          </p>{" "}
          <StartPickemPanel slug={selectedEvent.slug} />{" "}
          {/* Przyciski poniżej zmieniają wyłącznie status w bazie. Panel na Discordzie publikuje tylko "Uruchom typowanie" powyżej - bez tego rozróżnienia ludzie klikali "Otwórz event" i czekali na panel, który nigdy się nie pojawiał. */}{" "}
          <h3 className="ui-kicker">{t("adminPage.event.statusTitle")}</h3>{" "}
          <p className="ui-hint">{t("adminPage.event.statusHint")}</p>{" "}
          <div className="ui-row ui-row--wrap">
            {" "}
            <button
              type="button"
              className={selectedEvent.status === "OPEN"}
              disabled={changingStatus}
              onClick={() => handleEventStatusChange("OPEN")}
            >
              {" "}
              {t("adminPage.event.open")}{" "}
            </button>{" "}
            <button
              type="button"
              className="ui-choice__option"
              aria-pressed={selectedEvent.status === "CLOSED"}
              disabled={changingStatus}
              onClick={() => handleEventStatusChange("CLOSED")}
            >
              {" "}
              {t("adminPage.event.close")}{" "}
            </button>{" "}
            <button
              type="button"
              className="ui-choice__option"
              aria-pressed={Number(selectedEvent.is_archived) === 1}
              disabled={changingStatus}
              onClick={() => handleEventStatusChange("ARCHIVED")}
            >
              {" "}
              {t("adminPage.event.archive")}{" "}
            </button>{" "}
            <div className="ui-field">
              {" "}
              <label htmlFor="event-phase">
                {t("adminPage.event.phaseLabel")}
              </label>{" "}
              <select
                id="event-phase"
                value={selectedEvent.phase ?? "NOT_STARTED"}
                disabled={changingPhase}
                onChange={(event) => handleEventPhaseChange(event.target.value)}
              >
                {" "}
                <option value="NOT_STARTED">
                  {t("adminPage.event.notStarted")}
                </option>{" "}
                <option value="PLAY_IN">Play-In</option>{" "}
                <option value="SWISS">Swiss</option>{" "}
                <option value="SWISS_STAGE_1">Swiss — Stage 1</option>{" "}
                <option value="SWISS_STAGE_2">Swiss — Stage 2</option>{" "}
                <option value="SWISS_STAGE_3">Swiss — Stage 3</option>{" "}
                <option value="PLAYOFFS">Playoffs</option>{" "}
                <option value="DOUBLE_ELIM">Double Elimination</option>{" "}
                <option value="FINISHED">
                  {t("adminPage.event.finished")}
                </option>{" "}
              </select>{" "}
            </div>{" "}
            {phaseMessage && (
              <p
                className={`ui-note ${phaseMessage.ok ? "ui-note--ok" : "ui-note--danger"}`}
              >
                {" "}
                {phaseMessage.text}{" "}
              </p>
            )}{" "}
          </div>{" "}
          {statusMessage && (
            <p
              className={`ui-note ${statusMessage.ok ? "ui-note--ok" : "ui-note--danger"}`}
            >
              {" "}
              {statusMessage.text}{" "}
            </p>
          )}{" "}
        </section>
      )}{" "}
      {activeAdminSection === "matches" && selectedEvent && (
        <section className="ui-card ui-stack">
          {" "}
          <h2>{t("adminPage.matches.title")}</h2>{" "}
          <p>
            <T
              k="adminPage.matches.editing"
              vars={{ name: <strong>{selectedEvent.name}</strong> }}
            />
          </p>{" "}
          <form className="ui-card ui-stack" onSubmit={handleCreateMatch}>
            {" "}
            <select
              value={newMatchPhase}
              onChange={(event) => setNewMatchPhase(event.target.value)}
              disabled={creatingMatch}
            >
              {" "}
              <option value="SWISS">SWISS</option>{" "}
              <option value="PLAY_IN">PLAY_IN</option>{" "}
              <option value="PLAYOFFS">PLAYOFFS</option>{" "}
              <option value="DOUBLE_ELIM">DOUBLE_ELIM</option>{" "}
            </select>{" "}
            {loadingTeams && (
              <Ladowanie>{t("adminPage.matches.loadingTeams")}</Ladowanie>
            )}{" "}
            {teamsError && <p>{teamsError}</p>}{" "}
            <select
              value={newMatchTeamA}
              onChange={(event) => setNewMatchTeamA(event.target.value)}
              disabled={creatingMatch || loadingTeams}
              required
            >
              {" "}
              <option value="">{t("adminPage.matches.pickTeamA")}</option>{" "}
              {adminTeams.map((team) => (
                <option key={team.id} value={team.name}>
                  {" "}
                  {team.name}{" "}
                </option>
              ))}{" "}
            </select>{" "}
            <select
              value={newMatchTeamB}
              onChange={(event) => setNewMatchTeamB(event.target.value)}
              disabled={creatingMatch || loadingTeams}
              required
            >
              {" "}
              <option value="">{t("adminPage.matches.pickTeamB")}</option>{" "}
              {adminTeams.map((team) => (
                <option
                  key={team.id}
                  value={team.name}
                  disabled={team.name === newMatchTeamA}
                >
                  {" "}
                  {team.name}{" "}
                </option>
              ))}{" "}
            </select>{" "}
            <select
              value={newMatchBestOf}
              onChange={(event) => setNewMatchBestOf(event.target.value)}
              disabled={creatingMatch}
            >
              {" "}
              <option value="1">BO1</option> <option value="3">BO3</option>{" "}
              <option value="5">BO5</option>{" "}
            </select>{" "}
            <input
              type="datetime-local"
              value={newMatchStartTime}
              onChange={(event) => setNewMatchStartTime(event.target.value)}
              disabled={creatingMatch}
            />{" "}
            <button
              type="submit"
              className="ui-btn ui-btn--primary"
              disabled={
                creatingMatch || !newMatchTeamA.trim() || !newMatchTeamB.trim()
              }
            >
              {" "}
              {creatingMatch
                ? t("adminPage.matches.creating")
                : t("adminPage.matches.create")}{" "}
            </button>{" "}
            {createMatchMessage && (
              <p
                className={`ui-note ${createMatchMessage.ok ? "ui-note--ok" : "ui-note--danger"}`}
              >
                {" "}
                {createMatchMessage.text}{" "}
              </p>
            )}{" "}
          </form>{" "}
          <div className="ui-stack ui-stack--tight">
            {" "}
            <h3>{t("adminPage.matches.listTitle")}</h3>{" "}
            {/* Akcje na meczach (start, blokada, edycja, usuwanie) ustawiały komunikat, którego nikt nie renderował - admin klikał i nie dostawał zadnej informacji zwrotnej, takze przy bledzie. */}{" "}
            {matchActionMessage && (
              <p
                className={`ui-note ${matchActionMessage.ok ? "ui-note--ok" : "ui-note--danger"}`}
              >
                {" "}
                {matchActionMessage.tekst}{" "}
              </p>
            )}{" "}
            {loadingMatches && (
              <Ladowanie>{t("common.loadingMatches")}</Ladowanie>
            )}{" "}
            {matchesError && <p>{matchesError}</p>}{" "}
            {!loadingMatches && !matchesError && adminMatches.length === 0 && (
              <p>{t("adminPage.matches.empty")}</p>
            )}{" "}
            {adminMatches.map((match) => (
              // Wiersz meczu jest KOLUMNĄ, nie zawijanym wierszem. Wcześniej
              // karta miała ui-card--row, a w niej jako rodzeństwo leżało
              // siedem przycisków, trzy formularze i dopiero na końcu nazwa
              // meczu - wszystko zawijało się w jedną plamę, w której nie
              // dało się odróżnić opisu od akcji, a nazwa meczu wypadała PO
              // przyciskach, które jej dotyczą.
              //
              // Teraz są trzy piętra: kto gra i w jakim jest stanie, czym ten
              // stan przestawić, a pod kreską - operacje na meczu.
              <div
                key={match.id}
                className="ui-card ui-card--flat ui-card--tight ui-stack"
              >
                <div className="ui-row ui-row--between ui-row--wrap">
                  <div className="ui-stack ui-stack--tight">
                    <strong>
                      #{match.match_no} {match.team_a} vs {match.team_b}
                    </strong>

                    <span className="ui-hint">
                      {match.phase} · BO{match.best_of}{" "}
                      {t("adminPage.matches.start")}{" "}
                      {match.start_time_utc
                        ? new Date(match.start_time_utc).toLocaleString()
                        : t("adminPage.matches.noStart")}
                    </span>
                  </div>

                  <strong
                    className={`ui-badge ${TON_STATUSU[match.ui_status] ?? ""}`}
                  >
                    {match.ui_status}
                  </strong>
                </div>

                {/* Tryb blokady jako jeden przełącznik trójstanowy, a nie trzy
                    luźne przyciski. Stan niesie aria-pressed, więc osobna
                    plakietka "Tryb blokady: LOCK" jest już niepotrzebna -
                    widać go po wciśniętej opcji.

                    Przycisk LOCK miał wcześniej className={match.lock_override
                    === 1}, czyli wartość LOGICZNĄ w miejscu nazwy klasy: do
                    DOM-u trafiało class="true" albo class="false" i jako
                    jedyny z trójki nie miał żadnego stylu. */}
                <div className="ui-stack ui-stack--tight">
                  <span className="ui-hint">
                    {t("adminPage.matches.lockMode")}
                  </span>

                  <div className="ui-choice ui-choice--compact">
                    <button
                      type="button"
                      className="ui-choice__option"
                      aria-pressed={match.lock_override === 1}
                      disabled={lockingMatchId === match.id}
                      onClick={() => handleSetMatchLockMode(match, "lock")}
                    >
                      🔒 LOCK
                    </button>

                    <button
                      type="button"
                      className="ui-choice__option"
                      aria-pressed={match.lock_override === 0}
                      disabled={lockingMatchId === match.id}
                      onClick={() => handleSetMatchLockMode(match, "unlock")}
                    >
                      🔓 UNLOCK
                    </button>

                    <button
                      type="button"
                      className="ui-choice__option"
                      aria-pressed={match.lock_override === null}
                      disabled={lockingMatchId === match.id}
                      onClick={() => handleSetMatchLockMode(match, "auto")}
                    >
                      ⚙️ AUTO
                    </button>
                  </div>
                </div>

                <div className="ui-actions">
                  <button
                    type="button"
                    className="ui-btn ui-btn--sm"
                    onClick={() => {
                      setEditingMatchStartId(match.id);
                      if (match.start_time_utc) {
                        const date = new Date(match.start_time_utc);
                        const localValue = new Date(
                          date.getTime() - date.getTimezoneOffset() * 60000,
                        )
                          .toISOString()
                          .slice(0, 16);
                        setEditingMatchStartValue(localValue);
                      } else {
                        setEditingMatchStartValue("");
                      }
                      setMatchActionMessage(null);
                    }}
                  >
                    🕒 {t("adminPage.matches.setStart")}
                  </button>

                  <button
                    type="button"
                    className="ui-btn ui-btn--sm"
                    onClick={() => {
                      setEditingMatchId(match.id);
                      setEditingMatchTeamA(match.team_a);
                      setEditingMatchTeamB(match.team_b);
                      setEditingMatchBestOf(String(match.best_of));
                      setMatchActionMessage(null);
                    }}
                  >
                    ✏️ {t("adminPage.matches.edit")}
                  </button>

                  <Link
                    className="ui-btn ui-btn--sm"
                    to={`/admin/matches/${match.id}/result`}
                  >
                    📝 {t("adminPage.results.setResult")}
                  </Link>

                  <button
                    type="button"
                    className="ui-btn ui-btn--sm ui-btn--danger"
                    disabled={loadingMatchDeletePreview}
                    onClick={() => handleOpenDeleteMatch(match.id)}
                  >
                    🗑️ {t("adminPage.matches.delete")}
                  </button>
                </div>

                {deletingMatchId === match.id && matchDeletePreview && (
                  <div className="ui-card ui-card--flat ui-card--danger ui-card--tight ui-stack ui-stack--tight">
                    <strong>⚠️ {t("adminPage.matches.deleteAsk")}</strong>

                    <p className="ui-hint">
                      {t("adminPage.matches.deleteHint")}
                    </p>

                    <p>
                      <strong>
                        #{matchDeletePreview.match.matchNo}{" "}
                        {matchDeletePreview.match.teamA} vs{" "}
                        {matchDeletePreview.match.teamB}
                      </strong>
                      <br />
                      {matchDeletePreview.match.phase} · BO
                      {matchDeletePreview.match.bestOf}
                    </p>

                    <p className="ui-hint">
                      {t("adminPage.matches.deleteLinked")}
                      <br />
                      {t("adminPage.matches.deletePicks")}{" "}
                      {matchDeletePreview.usunie.typy}
                      <br />
                      {t("adminPage.matches.deleteMapPicks")}{" "}
                      {matchDeletePreview.usunie.typyMap}
                      <br />
                      {t("adminPage.matches.deleteResults")}{" "}
                      {matchDeletePreview.usunie.wyniki}
                      <br />
                      {t("adminPage.matches.deleteMapResults")}{" "}
                      {matchDeletePreview.usunie.wynikiMap}
                      <br />
                      {t("adminPage.matches.deletePoints")}{" "}
                      {matchDeletePreview.usunie.punkty}
                    </p>

                    <div className="ui-actions">
                      <button
                        type="button"
                        className="ui-btn ui-btn--sm ui-btn--danger"
                        onClick={() => handleDeleteMatch(match.id)}
                      >
                        🗑️ {t("adminPage.matches.deleteYes")}
                      </button>

                      <button
                        type="button"
                        className="ui-btn ui-btn--sm ui-btn--ghost"
                        onClick={() => {
                          setDeletingMatchId(null);
                          setMatchDeletePreview(null);
                          setMatchActionMessage(null);
                        }}
                      >
                        {t("common.cancel")}
                      </button>
                    </div>
                  </div>
                )}

                {editingMatchStartId === match.id && (
                  <div className="ui-card ui-card--flat ui-card--tight ui-stack ui-stack--tight">
                    <span className="ui-hint">
                      {t("adminPage.matches.startTitle")}
                    </span>

                    <div className="ui-row ui-row--wrap ui-row--full">
                      <input
                        className="ui-input"
                        type="datetime-local"
                        value={editingMatchStartValue}
                        onChange={(event) =>
                          setEditingMatchStartValue(event.target.value)
                        }
                      />

                      <button
                        type="button"
                        className="ui-btn ui-btn--sm ui-btn--primary"
                        disabled={savingMatchStart}
                        onClick={() => handleSaveMatchStart(match.id)}
                      >
                        {savingMatchStart
                          ? t("admin.saving")
                          : t("adminPage.matches.saveStart")}
                      </button>

                      <button
                        type="button"
                        className="ui-btn ui-btn--sm"
                        disabled={savingMatchStart}
                        onClick={() => handleSaveMatchStart(match.id, "")}
                      >
                        {t("adminPage.matches.deleteStart")}
                      </button>

                      <button
                        type="button"
                        className="ui-btn ui-btn--sm ui-btn--ghost"
                        disabled={savingMatchStart}
                        onClick={() => {
                          setEditingMatchStartId(null);
                          setEditingMatchStartValue("");
                        }}
                      >
                        Anuluj
                      </button>
                    </div>
                  </div>
                )}

                {editingMatchId === match.id && (
                  <div className="ui-card ui-card--flat ui-card--tight ui-stack ui-stack--tight">
                    <span className="ui-hint">
                      {t("adminPage.matches.editTitle")}
                    </span>

                    <div className="ui-row ui-row--wrap ui-row--full">
                      <select
                        className="ui-input"
                        value={editingMatchTeamA}
                        onChange={(event) =>
                          setEditingMatchTeamA(event.target.value)
                        }
                      >
                        {adminTeams.map((team) => (
                          <option key={team.id} value={team.name}>
                            {team.name}
                          </option>
                        ))}
                      </select>

                      <select
                        className="ui-input"
                        value={editingMatchTeamB}
                        onChange={(event) =>
                          setEditingMatchTeamB(event.target.value)
                        }
                      >
                        {adminTeams.map((team) => (
                          <option key={team.id} value={team.name}>
                            {team.name}
                          </option>
                        ))}
                      </select>

                      <select
                        className="ui-input"
                        value={editingMatchBestOf}
                        onChange={(event) =>
                          setEditingMatchBestOf(event.target.value)
                        }
                      >
                        <option value="1">BO1</option>
                        <option value="3">BO3</option>
                        <option value="5">BO5</option>
                      </select>
                    </div>

                    <div className="ui-actions">
                      <button
                        type="button"
                        className="ui-btn ui-btn--sm ui-btn--primary"
                        disabled={savingMatchEdit}
                        onClick={() => handleSaveMatchEdit(match.id)}
                      >
                        {savingMatchEdit
                          ? t("admin.saving")
                          : t("adminPage.matches.saveEdit")}
                      </button>

                      <button
                        type="button"
                        className="ui-btn ui-btn--sm ui-btn--ghost"
                        disabled={savingMatchEdit}
                        onClick={() => {
                          setEditingMatchId(null);
                          setMatchActionMessage(null);
                        }}
                      >
                        Anuluj
                      </button>

                      <button
                        type="button"
                        className="ui-btn ui-btn--sm ui-btn--danger"
                        disabled={loadingMatchDeletePreview}
                        onClick={() => handleOpenDeleteMatch(match.id)}
                      >
                        {loadingMatchDeletePreview &&
                        deletingMatchId === match.id
                          ? "Sprawdzanie..."
                          : `🗑️ ${t("adminPage.matches.delete")}`}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
      {activeAdminSection === "locks" && selectedEvent && (
        <section className="ui-card ui-stack">
          <h2>{t("adminPage.locks.title")}</h2>

          <p>
            Zarządzasz typowaniem dla: <strong>{selectedEvent.name}</strong>
          </p>
          <form
            className="ui-card ui-card--flat ui-card--row ui-card--tight"
            onSubmit={handleSaveDeadline}
          >
            <select
              value={deadlinePhase}
              onChange={(event) => setDeadlinePhase(event.target.value)}
              disabled={savingDeadline}
            >
              <option value="swiss">SWISS</option>
              <option value="playin">PLAY-IN</option>
              <option value="playoffs">PLAYOFFS</option>
              <option value="doubleelim">DOUBLE ELIM</option>
            </select>

            {deadlinePhase === "swiss" && (
              <select
                value={deadlineStage}
                onChange={(event) => setDeadlineStage(event.target.value)}
                disabled={savingDeadline}
              >
                <option value="1">Stage 1</option>
                <option value="2">Stage 2</option>
                <option value="3">Stage 3</option>
              </select>
            )}

            <input
              type="datetime-local"
              value={deadlineValue}
              onChange={(event) => setDeadlineValue(event.target.value)}
              disabled={savingDeadline}
              required
            />

            {deadlineValue && (
              <p
                className={`ui-badge ${
                  new Date(deadlineValue) < new Date()
                    ? "ui-badge--danger"
                    : "ui-badge--ok"
                }`}
              >
                {new Date(deadlineValue) < new Date()
                  ? `⛔ ${t("adminPage.locks.expired")}`
                  : `🟢 ${t("adminPage.locks.active")}`}
              </p>
            )}

            <button
              type="submit"
              className="ui-btn ui-btn--primary"
              disabled={savingDeadline || !deadlineValue}
            >
              {savingDeadline
                ? t("admin.saving")
                : t("adminPage.locks.save")}
            </button>

            <button
              type="button"
              className="ui-btn ui-btn--ghost"
              onClick={handleClearDeadline}
              disabled={savingDeadline || !deadlineValue}
            >
              {t("adminPage.locks.clear")}
            </button>

            {deadlineMessage && (
              <p
                // Ton bierze się z osobnego stanu, a nie z wyszukania
                // słowa "został" w treści: po przetłumaczeniu strony tego
                // słowa tam nie ma i sukces malowałby się na czerwono.
                className={`ui-note ${
                  deadlineUdane ? "ui-note--ok" : "ui-note--danger"
                }`}
              >
                {deadlineMessage}
              </p>
            )}
          </form>
        </section>
      )}
      {activeAdminSection === "results" && selectedEvent && (
        <section className="ui-card ui-stack">
          <h2>{t("adminPage.results.title")}</h2>

          <p>
            {t("adminPage.results.event")} <strong>{selectedEvent.name}</strong>
          </p>

          <div className="ui-stack ui-stack--tight">
            {loadingMatches && (
              <Ladowanie>{t("common.loadingMatches")}</Ladowanie>
            )}

            {matchesError && <p>{matchesError}</p>}

            {!loadingMatches && !matchesError && adminMatches.length === 0 && (
              <p>{t("adminPage.matches.empty")}</p>
            )}

            {adminMatches.map((match) => (
              // Ten sam układ co w "Zarządzanie meczami": opis po lewej,
              // stany po prawej, akcja pod kreską. Wcześniej i tu wszystko
              // leżało w jednym zawijanym wierszu, a link do wpisania wyniku
              // był gołym <Link> bez klasy - czyli zwykłym tekstem pośród
              // plakietek.
              <div
                key={match.id}
                className="ui-card ui-card--flat ui-card--tight ui-stack"
              >
                <div className="ui-row ui-row--between ui-row--wrap">
                  <div className="ui-stack ui-stack--tight">
                    <strong>
                      #{match.match_no} {match.team_a} vs {match.team_b}
                    </strong>

                    <span className="ui-hint">
                      {match.phase} · BO{match.best_of}{" "}
                      {t("adminPage.matches.start")}{" "}
                      {match.start_time_utc
                        ? new Date(match.start_time_utc).toLocaleString(jezyk)
                        : t("adminPage.matches.noStart")}
                    </span>
                  </div>

                  <div className="ui-row ui-row--wrap">
                    <strong
                      className={`ui-badge ${TON_STATUSU[match.ui_status] ?? ""}`}
                    >
                      {match.ui_status}
                    </strong>

                    {/* Emoji odróżnia tryb blokady od statusu - bez niego
                        "AUTO" obok "OPEN" nie mówi, czego dotyczy. */}
                    <strong
                      className={`ui-badge ${TON_BLOKADY[match.lock_override] ?? ""}`}
                    >
                      🔒 {ETYKIETA_BLOKADY[match.lock_override] ?? "AUTO"}
                    </strong>

                    <strong
                      className={`ui-badge ${
                        match.ui_status === "FINAL"
                          ? "ui-badge--ok"
                          : "ui-badge--warn"
                      }`}
                    >
                      {match.ui_status === "FINAL"
                        ? t("adminPage.results.set")
                        : t("adminPage.results.missing")}
                    </strong>
                  </div>
                </div>

                <div className="ui-actions">
                  <Link
                    className="ui-btn ui-btn--sm"
                    to={`/admin/matches/${match.id}/result`}
                  >
                    {match.ui_status === "FINAL"
                      ? `✏️ ${t("adminPage.results.edit")}`
                      : `📝 ${t("adminPage.results.setResult")}`}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      {activeAdminSection === "phases" && selectedEvent && (
        <section className="ui-card ui-stack">
          <h2>
            {t("adminPage.section.phases", { name: selectedEvent.name })}
          </h2>

          <PhaseResultsAdmin slug={selectedEvent.slug} teams={adminTeams} />
        </section>
      )}
      {activeAdminSection === "pickemcfg" && selectedEvent && (
        <section className="ui-card ui-stack">
          <h2>
            {t("adminPage.section.pickemcfg", { name: selectedEvent.name })}
          </h2>

          <PickemConfigPanel slug={selectedEvent.slug} />
        </section>
      )}
      {activeAdminSection === "mvp" && selectedEvent && (
        <section className="ui-card ui-stack">
          <h2>{t("adminPage.section.mvp", { name: selectedEvent.name })}</h2>

          <MvpAdminPanel slug={selectedEvent.slug} />
        </section>
      )}
      {activeAdminSection === "ops" && selectedEvent && (
        <section className="ui-card ui-stack">
          <h2>
            {t("adminPage.section.ops", { name: selectedEvent.name })}
          </h2>

          <TournamentOpsPanel
            guildId={selectedServer.guild_id}
            slug={selectedEvent.slug}
          />
        </section>
      )}
      {activeAdminSection === "teams" && selectedServer && (
        <section className="ui-card ui-stack">
          <h2>{t("adminPage.teams.title")}</h2>

          <form className="ui-card ui-stack" onSubmit={handleCreateTeam}>
            <input
              type="text"
              placeholder={t("adminPage.teams.name")}
              value={newTeamName}
              onChange={(event) => setNewTeamName(event.target.value)}
              disabled={creatingTeam}
              required
            />

            <button
              type="submit"
              className="ui-btn ui-btn--primary"
              disabled={creatingTeam || !newTeamName.trim()}
            >
              {creatingTeam
                ? t("adminPage.teams.adding")
                : t("adminPage.teams.add")}
            </button>

            {createTeamMessage && <p>{createTeamMessage}</p>}
          </form>

          {teamEditMessage && (
            <p
              className={`ui-note ${teamEditMessage.ok ? "ui-note--ok" : "ui-note--danger"}`}
            >
              {teamEditMessage.text}
            </p>
          )}

          {teamDeleteMessage && (
            <p
              className={`ui-note ${teamDeleteMessage.ok ? "ui-note--ok" : "ui-note--danger"}`}
            >
              {teamDeleteMessage.text}
            </p>
          )}

          <div className="ui-stack ui-stack--tight">
            {loadingTeams && (
              <Ladowanie>{t("adminPage.matches.loadingTeams")}</Ladowanie>
            )}

            {teamsError && <p>{teamsError}</p>}

            {!loadingTeams && !teamsError && adminTeams.length === 0 && (
              <p>{t("adminPage.teams.empty")}</p>
            )}

            {adminTeams.map((team) => (
              <div
                key={team.id}
                className="ui-card ui-card--flat ui-card--row ui-card--tight"
              >
                {editingTeamId === team.id ? (
                  <div className="ui-row ui-row--wrap ui-row--full">
                    <input
                      type="text"
                      value={editingTeamName}
                      onChange={(event) =>
                        setEditingTeamName(event.target.value)
                      }
                      disabled={savingTeamEdit}
                    />

                    <button
                      type="button"
                      className="ui-btn ui-btn--sm ui-btn--primary"
                      onClick={() => handleSaveTeamEdit(team.id)}
                      disabled={savingTeamEdit || !editingTeamName.trim()}
                    >
                      {savingTeamEdit ? t("admin.saving") : t("common.save")}
                    </button>

                    <button
                      type="button"
                      className="ui-btn ui-btn--sm ui-btn--ghost"
                      onClick={() => {
                        setEditingTeamId(null);
                        setEditingTeamName("");
                      }}
                      disabled={savingTeamEdit}
                    >
                      Anuluj
                    </button>
                  </div>
                ) : (
                  <>
                    <strong>{team.name}</strong>

                    <span>
                      Status:{" "}
                      <strong
                        className={`ui-badge ${
                          team.active ? "ui-badge--ok" : "ui-badge--danger"
                        }`}
                      >
                        {team.active ? "AKTYWNA" : "NIEAKTYWNA"}
                      </strong>
                    </span>

                    <button
                      type="button"
                      className="ui-btn ui-btn--sm"
                      onClick={() => {
                        setEditingTeamId(team.id);
                        setEditingTeamName(team.name);
                        setTeamEditMessage(null);
                      }}
                    >
                      {t("adminPage.matches.edit")}
                    </button>

                    <button
                      type="button"
                      className="ui-btn ui-btn--sm"
                      onClick={() => handleToggleTeamActive(team)}
                      disabled={togglingTeamId === team.id}
                    >
                      {togglingTeamId === team.id
                        ? t("admin.saving")
                        : team.active
                          ? t("adminPage.teams.deactivate")
                          : t("adminPage.teams.activate")}
                    </button>

                    <button
                      type="button"
                      className="ui-btn ui-btn--danger"
                      onClick={() => handleDeleteTeam(team)}
                      disabled={deletingTeamId === team.id}
                    >
                      {deletingTeamId === team.id
                        ? t("adminPage.matches.deleting")
                        : t("adminPage.matches.delete")}
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
      {selectedEvent && (
        <section className="ui-card ui-stack">
          <h2>{t("adminPage.leaderboard.title")}</h2>

          {loadingLeaderboard && (
            <Ladowanie>{t("adminPage.leaderboard.loading")}</Ladowanie>
          )}

          {leaderboardError && (
            <p className="ui-note ui-note--danger">{leaderboardError}</p>
          )}

          {!loadingLeaderboard &&
            !leaderboardError &&
            eventLeaderboard.length === 0 && (
              <p>{t("adminPage.leaderboard.empty")}</p>
            )}

          {!loadingLeaderboard &&
            !leaderboardError &&
            eventLeaderboard.length > 0 && (
              <div className="ui-datatable">
                <div className="ui-datatable__head" aria-hidden="true">
                  {KOLUMNY_KLASYFIKACJI.map((kolumna) => (
                    <span key={kolumna}>{t(kolumna)}</span>
                  ))}
                </div>

                {eventLeaderboard.map((player) => (
                  <div
                    className={`ui-datatable__row${
                      PODIUM_KLASYFIKACJI[player.rank] ?? ""
                    }`}
                    key={player.user_id}
                  >
                    <span data-label={t("adminPage.column.place")}>#{player.rank}</span>

                    <strong data-label={t("adminPage.column.player")}>
                      {player.displayname ?? player.user_id}
                    </strong>

                    <span data-label={t("adminPage.column.points")}>
                      {Number(player.total_points ?? 0)}
                    </span>

                    <span data-label={t("adminPage.column.series")}>
                      {Number(player.series_points ?? 0)}
                    </span>

                    <span data-label={t("adminPage.column.maps")}>
                      {Number(player.map_points ?? 0)}
                    </span>

                    <span data-label={t("adminPage.column.picks")}>
                      {Number(player.total_predictions ?? 0)}
                    </span>

                    <span data-label={t("adminPage.column.hits")}>
                      {Number(player.correct_winners ?? 0)}
                    </span>

                    <span data-label={t("adminPage.column.mapHits")}>
                      {Number(player.correct_maps ?? 0)}
                    </span>

                    <span data-label={t("adminPage.column.exacts")}>
                      {Number(player.exact_maps ?? 0)}
                    </span>

                    <span data-label={t("adminPage.column.accuracy")}>
                      {Number(player.accuracy ?? 0)}%
                    </span>
                  </div>
                ))}
              </div>
            )}
        </section>
      )}
      <form className="ui-card ui-stack" onSubmit={handleCreateEvent}>
        <h3>{t("adminPage.newEvent.title")}</h3>

        <div className="ui-row ui-row--wrap ui-row--full">
          <input
            type="text"
            placeholder={t("adminPage.newEvent.name")}
            value={newEventName}
            onChange={(event) => setNewEventName(event.target.value)}
            disabled={creatingEvent}
            required
          />

          <input
            type="text"
            placeholder={t("adminPage.newEvent.slug")}
            value={newEventSlug}
            onChange={(event) => setNewEventSlug(event.target.value)}
            disabled={creatingEvent}
            pattern="[a-z0-9-]+"
            title={t("adminPage.newEvent.slugHint")}
            required
          />

          <button
            type="submit"
            className="ui-btn ui-btn--primary"
            disabled={
              creatingEvent || !newEventName.trim() || !newEventSlug.trim()
            }
          >
            {creatingEvent
              ? t("adminPage.newEvent.creating")
              : t("adminPage.newEvent.create")}
          </button>
        </div>

        {createEventMessage && (
          <p
            className={`ui-note ${createEventMessage.ok ? "ui-note--ok" : "ui-note--danger"}`}
          >
            {createEventMessage.text}
          </p>
        )}
      </form>
      <Link to="/" className="ui-btn ui-btn--ghost ui-btn--sm">
        {t("adminPage.back")}
      </Link>
    </div>
  );
}
