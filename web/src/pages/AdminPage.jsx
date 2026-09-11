import { Link } from "react-router-dom";
import { useAuth } from "../auth/useAuth.js";
import { odmien } from "../lib/odmiana.js";
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
import { isAdminAnywhere, adminGuildIds } from "../lib/permissions.js";
import PhaseResultsAdmin from "../components/admin/PhaseResultsAdmin.jsx";
import MvpAdminPanel from "../components/admin/MvpAdminPanel.jsx";
import TournamentOpsPanel from "../components/admin/TournamentOpsPanel.jsx";
import StartPickemPanel from "../components/admin/StartPickemPanel.jsx";
import PickemConfigPanel from "../components/admin/PickemConfigPanel.jsx";
import Ladowanie from "../components/Ladowanie.jsx";
// Ton plakietki statusu meczu. Wczesniej nazwa klasy powstawala ze sklejenia
// "admin-badge--status-" i statusu z API - czyli CSS musial znac z gory kazda
// wartosc, jaka backend kiedykolwiek zwroci, a literowka byla niewidoczna.
const TON_STATUSU = {
  OPEN: "ui-badge--ok",
  LOCKED: "ui-badge--danger",
  FINAL: "",
};

export default function AdminPage() {
  const { user, authLoading } = useAuth();
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

  // Ta sama reguła co w navbarze i na stronie wpisywania wyniku -
  // trzymana w jednym miejscu, żeby nie rozjechały się trzy kopie
  // porównywania bitmaski uprawnień.
  const isAdmin = isAdminAnywhere(user);

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
        setServersError(err.message || "Nie udało się pobrać serwerów.");
      } finally {
        setLoadingServers(false);
      }
    }

    loadServers();
  }, [authLoading, user, isAdmin]);

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
        setEventsError(err.message || "Nie udało się pobrać eventów.");
        setServerEvents([]);
      } finally {
        setLoadingEvents(false);
      }
    }

    loadServerEvents();
  }, [selectedServer]);

  useEffect(() => {
    if (!selectedServer) return;

    async function loadAdminTeams() {
      try {
        setLoadingTeams(true);
        setTeamsError("");

        const data = await getAdminTeams(selectedServer.guild_id);

        setAdminTeams(data.teams ?? []);
      } catch (err) {
        setTeamsError(err.message || "Nie udało się pobrać drużyn.");

        setAdminTeams([]);
      } finally {
        setLoadingTeams(false);
      }
    }

    loadAdminTeams();
  }, [selectedServer]);

  useEffect(() => {
    if (!selectedEvent) return;

    async function loadAdminMatches() {
      try {
        setLoadingMatches(true);
        setMatchesError("");

        const data = await getAdminMatches(selectedEvent.slug);

        setAdminMatches(data.matches ?? []);
      } catch (err) {
        setMatchesError(err.message || "Nie udało się pobrać meczów.");

        setAdminMatches([]);
      } finally {
        setLoadingMatches(false);
      }
    }

    loadAdminMatches();
  }, [selectedEvent]);

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
          err.message || "Nie udało się pobrać rankingu eventu.",
        );

        setEventLeaderboard([]);
      } finally {
        setLoadingLeaderboard(false);
      }
    }

    loadEventLeaderboard();
  }, [selectedEvent]);

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
      const confirmed = window.confirm(
        `Na pewno zarchiwizować event "${selectedEvent.name}"?`,
      );

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

      setStatusMessage({ text: "Status eventu został zmieniony.", ok: true });
    } catch (err) {
      setStatusMessage({
        text: err.message || "Nie udało się zmienić statusu.",
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

      setPhaseMessage({ text: "Faza eventu została zmieniona.", ok: true });
    } catch (err) {
      setPhaseMessage({
        text: err.message || "Nie udało się zmienić fazy.",
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

      setCreateEventMessage({ text: "Event został utworzony.", ok: true });
    } catch (err) {
      setCreateEventMessage({
        text: err.message || "Nie udało się utworzyć eventu.",
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
          ? "Start meczu został zapisany."
          : "Start meczu został usunięty.",
        ok: true,
      });
    } catch (err) {
      setMatchActionMessage({
        tekst: err.message || "Nie udało się zapisać startu meczu.",
        ok: false,
      });
    } finally {
      setSavingMatchStart(false);
    }
  }

  if (authLoading) {
    return (
      <div className="ui-page">
        <p>Sprawdzanie uprawnień...</p>
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

      setCreateTeamMessage("Drużyna została dodana.");
    } catch (err) {
      setCreateTeamMessage(err.message || "Nie udało się dodać drużyny.");
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

      setTeamEditMessage({ text: "Drużyna została zaktualizowana.", ok: true });
    } catch (err) {
      setTeamEditMessage({
        text: err.message || "Nie udało się zaktualizować drużyny.",
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

    const confirmed = window.confirm(`Na pewno usunąć drużynę "${team.name}"?`);

    if (!confirmed) {
      return;
    }

    try {
      setDeletingTeamId(team.id);
      setTeamDeleteMessage(null);

      await deleteAdminTeam(selectedServer.guild_id, team.id);

      const teamsData = await getAdminTeams(selectedServer.guild_id);

      setAdminTeams(teamsData.teams ?? []);

      setTeamDeleteMessage({ text: "Drużyna została usunięta.", ok: true });
    } catch (err) {
      setTeamDeleteMessage({
        text: err.message || "Nie udało się usunąć drużyny.",
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
          ? { text: "Drużyna została dezaktywowana.", ok: true }
          : { text: "Drużyna została aktywowana.", ok: true },
      );
    } catch (err) {
      setTeamEditMessage({
        text: err.message || "Nie udało się zmienić statusu drużyny.",
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

      setCreateMatchMessage({ text: "Mecz został utworzony.", ok: true });
    } catch (err) {
      setCreateMatchMessage({
        text: err.message || "Nie udało się utworzyć meczu.",
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

      setDeadlineMessage("Deadline został zapisany.");
    } catch (err) {
      if (err.message?.includes("No active panel found")) {
        setDeadlineMessage(
          "Brak aktywnego panelu typowania dla tej fazy. Najpierw opublikuj odpowiedni panel na Discordzie.",
        );
      } else {
        setDeadlineMessage(err.message || "Nie udało się zapisać deadline'u.");
      }
    } finally {
      setSavingDeadline(false);
    }
  }

  async function handleClearDeadline() {
    if (!selectedServer) {
      return;
    }

    const confirmed = window.confirm("Na pewno wyczyścić ten deadline?");

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
      setDeadlineMessage("Deadline został wyczyszczony.");
    } catch (err) {
      setDeadlineMessage(err.message || "Nie udało się wyczyścić deadline'u.");
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
        lock: "Mecz został ręcznie zablokowany.",
        unlock: "Mecz został ręcznie odblokowany.",
        auto: "Przywrócono automatyczne sterowanie blokadą.",
      };

      if (opis[mode]) {
        setMatchActionMessage({ tekst: opis[mode], ok: true });
      }
    } catch (err) {
      setMatchActionMessage({
        tekst: err.message || "Nie udało się zmienić trybu blokady.",
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
        tekst: "Zmiany w meczu zostały zapisane.",
        ok: true,
      });
    } catch (err) {
      setMatchActionMessage({
        tekst: err.message || "Nie udało się zapisać zmian w meczu.",
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
        tekst: err.message || "Nie udało się pobrać podglądu usuwania meczu.",
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

      setMatchActionMessage({ tekst: "Mecz został usunięty.", ok: true });
    } catch (err) {
      setMatchActionMessage({
        tekst: err.message || "Nie udało się usunąć meczu.",
        ok: false,
      });
    }
  }

  if (!user) {
    return (
      <div className="ui-page">
        <p>Musisz się zalogować przez Discord.</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="ui-page">
        <p>Brak uprawnień administratora.</p>
      </div>
    );
  }

  return (
    <div className="ui-page">
      <header className="ui-section-head">
        <span>⚙️ ADMIN</span>
        <h1>Panel administratora</h1>
        <p>Zarządzanie turniejami, meczami, wynikami i typowaniem.</p>
      </header>
      <section className="ui-card ui-stack">
        <h2>Twoje serwery</h2>
        {loadingServers && <Ladowanie>Ładowanie serwerów...</Ladowanie>}
        {serversError && <p>{serversError}</p>}
        {!loadingServers && !serversError && adminServers.length === 0 && (
          <p>Nie znaleziono serwerów, którymi możesz zarządzać.</p>
        )}
        {!loadingServers &&
          adminServers.map((server) => (
            <button
              key={server.guild_id}
              type="button"
              className="ui-choice__option"
              aria-pressed={`ui-card ui-card--flat ui-card--row ui-card--interactive ${selectedServer?.guild_id === server.guild_id ? "ui-card--selected" : ""}`}
              onClick={() => setSelectedServer(server)}
            >
              {" "}
              <strong>{server.name}</strong>{" "}
              <span>
                {" "}
                {server.events_count ?? 0}{" "}
                {odmien(
                  server.events_count ?? 0,
                  "event",
                  "eventy",
                  "eventów",
                )}{" "}
              </span>{" "}
            </button>
          ))}{" "}
      </section>{" "}
      {selectedServer && (
        <section className="ui-card ui-stack">
          {" "}
          <h2>Eventy</h2>{" "}
          {loadingEvents && <Ladowanie>Ładowanie eventów...</Ladowanie>}{" "}
          {eventsError && <p>{eventsError}</p>}{" "}
          {!loadingEvents && !eventsError && serverEvents.length === 0 && (
            <p>Brak eventów na tym serwerze.</p>
          )}{" "}
          {!loadingEvents &&
            serverEvents.map((event) => (
              <button
                key={event.id}
                type="button"
                className="ui-choice__option"
                aria-pressed={`ui-card ui-card--flat ui-card--row ui-card--interactive ${selectedEvent?.id === event.id ? "ui-card--selected" : ""}`}
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
          <span>🏆 Eventy</span> <strong>Zarządzaj turniejem</strong>{" "}
          <p>
            {" "}
            {selectedEvent
              ? `Wybrano: ${selectedEvent.name}`
              : "Najpierw wybierz event."}{" "}
          </p>{" "}
        </button>{" "}
        <button
          type="button"
          className={`ui-card ui-card--interactive ui-tile ${activeAdminSection === "matches" ? "ui-card--selected" : ""}`}
          disabled={!selectedEvent}
          onClick={() => setActiveAdminSection("matches")}
        >
          {" "}
          <span>🎯 Mecze</span> <strong>Zarządzaj meczami</strong>{" "}
          <p>
            {" "}
            {selectedEvent
              ? `Wybrano: ${selectedEvent.name}`
              : "Najpierw wybierz event."}{" "}
          </p>{" "}
        </button>{" "}
        <button
          type="button"
          className={`ui-card ui-card--interactive ui-tile ${activeAdminSection === "locks" ? "ui-card--selected" : ""}`}
          disabled={!selectedEvent}
          onClick={() => setActiveAdminSection("locks")}
        >
          {" "}
          <span>🔒 Typowanie</span> <strong>Locki i deadline'y</strong>{" "}
          <p>
            {" "}
            {selectedEvent
              ? `Wybrano: ${selectedEvent.name}`
              : "Najpierw wybierz event."}{" "}
          </p>{" "}
        </button>{" "}
        <button
          type="button"
          className="ui-card ui-card--interactive ui-tile"
          disabled={!selectedEvent}
          onClick={() => setActiveAdminSection("results")}
        >
          {" "}
          <span>📊 Wyniki</span> <strong>Wyniki Pick'Em</strong>{" "}
          <p>Ustawianie wyników meczów i zarządzanie rezultatami.</p>{" "}
        </button>{" "}
        <button
          type="button"
          className={`ui-card ui-card--interactive ui-tile ${activeAdminSection === "phases" ? "ui-card--selected" : ""}`}
          disabled={!selectedEvent}
          onClick={() => setActiveAdminSection("phases")}
        >
          {" "}
          <span>🏁 Wyniki faz</span>{" "}
          <strong>Swiss / Playoffs / Play-In / DE</strong>{" "}
          <p>Oficjalne wyniki faz Pick'Em i przeliczanie punktów.</p>{" "}
        </button>{" "}
        <button
          type="button"
          className={`ui-card ui-card--interactive ui-tile ${activeAdminSection === "pickemcfg" ? "ui-card--selected" : ""}`}
          disabled={!selectedEvent}
          onClick={() => setActiveAdminSection("pickemcfg")}
        >
          {" "}
          <span>🧩 Typowanie drużyn</span> <strong>Fazy i liczby drużyn</strong>{" "}
          <p>Konfiguracja typowania drużyn dla tego eventu.</p>{" "}
        </button>{" "}
        <button
          type="button"
          className={`ui-card ui-card--interactive ui-tile ${activeAdminSection === "mvp" ? "ui-card--selected" : ""}`}
          disabled={!selectedEvent}
          onClick={() => setActiveAdminSection("mvp")}
        >
          {" "}
          <span>⭐ MVP</span> <strong>Kandydaci i zwycięzca</strong>{" "}
          <p>Lista kandydatów oraz wskazanie MVP turnieju.</p>{" "}
        </button>{" "}
        <button
          type="button"
          className={`ui-card ui-card--interactive ui-tile ${activeAdminSection === "ops" ? "ui-card--selected" : ""}`}
          disabled={!selectedEvent}
          onClick={() => setActiveAdminSection("ops")}
        >
          {" "}
          <span>🛠️ Operacje</span>{" "}
          <strong>Mecze hurtem, kopie, zamknięcie</strong>{" "}
          <p>
            {" "}
            Tworzenie meczów, propozycje wyników, backupy, koniec turnieju.
            Start typowania jest w „Zarządzanie eventem”.{" "}
          </p>{" "}
        </button>{" "}
        <button
          type="button"
          className={`ui-card ui-card--interactive ui-tile ${activeAdminSection === "teams" ? "ui-card--selected" : ""}`}
          disabled={!selectedServer}
          onClick={() => setActiveAdminSection("teams")}
        >
          {" "}
          <span>👥 Drużyny</span> <strong>Zarządzaj drużynami</strong>{" "}
          <p>Dodawanie, edycja i zarządzanie drużynami na serwerze.</p>{" "}
        </button>{" "}
      </div>{" "}
      {activeAdminSection === "events" && selectedEvent && (
        <section className="ui-card ui-stack">
          {" "}
          <h2>Zarządzanie eventem</h2>{" "}
          <p>
            {" "}
            Aktualnie edytujesz: <strong>{selectedEvent.name}</strong>{" "}
          </p>{" "}
          <StartPickemPanel slug={selectedEvent.slug} />{" "}
          {/* Przyciski poniżej zmieniają wyłącznie status w bazie. Panel na Discordzie publikuje tylko "Uruchom typowanie" powyżej - bez tego rozróżnienia ludzie klikali "Otwórz event" i czekali na panel, który nigdy się nie pojawiał. */}{" "}
          <h3 className="ui-kicker">Status turnieju</h3>{" "}
          <p className="ui-hint">
            {" "}
            Zmienia tylko stan zapisany w bazie. Nie publikuje ani nie usuwa
            panelu na Discordzie.{" "}
          </p>{" "}
          <div className="ui-row ui-row--wrap">
            {" "}
            <button
              type="button"
              className={selectedEvent.status === "OPEN"}
              disabled={changingStatus}
              onClick={() => handleEventStatusChange("OPEN")}
            >
              {" "}
              Otwórz event{" "}
            </button>{" "}
            <button
              type="button"
              className="ui-choice__option"
              aria-pressed={selectedEvent.status === "CLOSED"}
              disabled={changingStatus}
              onClick={() => handleEventStatusChange("CLOSED")}
            >
              {" "}
              Zamknij event{" "}
            </button>{" "}
            <button
              type="button"
              className="ui-choice__option"
              aria-pressed={Number(selectedEvent.is_archived) === 1}
              disabled={changingStatus}
              onClick={() => handleEventStatusChange("ARCHIVED")}
            >
              {" "}
              Archiwizuj{" "}
            </button>{" "}
            <div className="ui-field">
              {" "}
              <label htmlFor="event-phase">Faza eventu</label>{" "}
              <select
                id="event-phase"
                value={selectedEvent.phase ?? "NOT_STARTED"}
                disabled={changingPhase}
                onChange={(event) => handleEventPhaseChange(event.target.value)}
              >
                {" "}
                <option value="NOT_STARTED">Nie rozpoczęto</option>{" "}
                <option value="PLAY_IN">Play-In</option>{" "}
                <option value="SWISS">Swiss</option>{" "}
                <option value="SWISS_STAGE_1">Swiss — Stage 1</option>{" "}
                <option value="SWISS_STAGE_2">Swiss — Stage 2</option>{" "}
                <option value="SWISS_STAGE_3">Swiss — Stage 3</option>{" "}
                <option value="PLAYOFFS">Playoffs</option>{" "}
                <option value="DOUBLE_ELIM">Double Elimination</option>{" "}
                <option value="FINISHED">Zakończony</option>{" "}
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
          <h2>Zarządzanie meczami</h2>{" "}
          <p>
            {" "}
            Aktualnie edytujesz mecze dla:{" "}
            <strong>{selectedEvent.name}</strong>{" "}
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
            {loadingTeams && <Ladowanie>Ładowanie drużyn...</Ladowanie>}{" "}
            {teamsError && <p>{teamsError}</p>}{" "}
            <select
              value={newMatchTeamA}
              onChange={(event) => setNewMatchTeamA(event.target.value)}
              disabled={creatingMatch || loadingTeams}
              required
            >
              {" "}
              <option value="">Wybierz Team A</option>{" "}
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
              <option value="">Wybierz Team B</option>{" "}
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
              disabled={
                creatingMatch || !newMatchTeamA.trim() || !newMatchTeamB.trim()
              }
            >
              {" "}
              {creatingMatch ? "Tworzenie..." : "Utwórz mecz"}{" "}
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
            <h3>Mecze eventu</h3>{" "}
            {/* Akcje na meczach (start, blokada, edycja, usuwanie) ustawiały komunikat, którego nikt nie renderował - admin klikał i nie dostawał zadnej informacji zwrotnej, takze przy bledzie. */}{" "}
            {matchActionMessage && (
              <p
                className={`ui-note ${matchActionMessage.ok ? "ui-note--ok" : "ui-note--danger"}`}
              >
                {" "}
                {matchActionMessage.tekst}{" "}
              </p>
            )}{" "}
            {loadingMatches && <Ladowanie>Ładowanie meczów...</Ladowanie>}{" "}
            {matchesError && <p>{matchesError}</p>}{" "}
            {!loadingMatches && !matchesError && adminMatches.length === 0 && (
              <p>Brak meczów w tym evencie.</p>
            )}{" "}
            {adminMatches.map((match) => (
              <div
                key={match.id}
                className="ui-card ui-card--flat ui-card--row ui-card--tight"
              >
                {" "}
                <button
                  type="button"
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
                  {" "}
                  🕒 Ustaw start{" "}
                </button>{" "}
                <button
                  type="button"
                  className={match.lock_override === 1}
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
                <button
                  type="button"
                  onClick={() => {
                    setEditingMatchId(match.id);
                    setEditingMatchTeamA(match.team_a);
                    setEditingMatchTeamB(match.team_b);
                    setEditingMatchBestOf(String(match.best_of));
                    setMatchActionMessage(null);
                  }}
                >
                  ✏️ Edytuj
                </button>
                <Link to={`/admin/matches/${match.id}/result`}>
                  📝 Ustaw wynik
                </Link>
                <button
                  type="button"
                  className="ui-btn ui-btn--danger"
                  disabled={loadingMatchDeletePreview}
                  onClick={() => handleOpenDeleteMatch(match.id)}
                >
                  🗑️ Usuń
                </button>
                {deletingMatchId === match.id && matchDeletePreview && (
                  <div className="ui-card ui-card--flat ui-card--danger ui-card--tight">
                    <strong>⚠️ Usunąć ten mecz?</strong>

                    <p>
                      Ta operacja usunie również wszystkie dane powiązane z tym
                      meczem.
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

                    <p>
                      Powiązane dane do usunięcia:
                      <br />
                      Typy: {matchDeletePreview.usunie.typy}
                      <br />
                      Typy map: {matchDeletePreview.usunie.typyMap}
                      <br />
                      Wyniki: {matchDeletePreview.usunie.wyniki}
                      <br />
                      Wyniki map: {matchDeletePreview.usunie.wynikiMap}
                      <br />
                      Punkty: {matchDeletePreview.usunie.punkty}
                    </p>
                    <div className="ui-row ui-row--wrap">
                      <button
                        type="button"
                        className="ui-btn ui-btn--danger"
                        onClick={() => handleDeleteMatch(match.id)}
                      >
                        🗑️ Tak, usuń mecz
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setDeletingMatchId(null);
                          setMatchDeletePreview(null);
                          setMatchActionMessage(null);
                        }}
                      >
                        Anuluj
                      </button>
                    </div>
                  </div>
                )}
                {editingMatchStartId === match.id && (
                  <div className="ui-card ui-card--flat ui-card--tight">
                    <div className="ui-row ui-row--wrap ui-row--full">
                      <input
                        type="datetime-local"
                        value={editingMatchStartValue}
                        onChange={(event) =>
                          setEditingMatchStartValue(event.target.value)
                        }
                      />

                      <button
                        type="button"
                        disabled={savingMatchStart}
                        onClick={() => handleSaveMatchStart(match.id)}
                      >
                        {savingMatchStart ? "Zapisywanie..." : "Zapisz start"}
                      </button>

                      <button
                        type="button"
                        disabled={savingMatchStart}
                        onClick={() => handleSaveMatchStart(match.id, "")}
                      >
                        Usuń start
                      </button>

                      <button
                        type="button"
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
                  <div className="ui-card ui-card--flat ui-card--tight">
                    <div className="ui-row ui-row--wrap ui-row--full">
                      <select
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
                        value={editingMatchBestOf}
                        onChange={(event) =>
                          setEditingMatchBestOf(event.target.value)
                        }
                      >
                        <option value="1">BO1</option>
                        <option value="3">BO3</option>
                        <option value="5">BO5</option>
                      </select>

                      <button
                        type="button"
                        disabled={savingMatchEdit}
                        onClick={() => handleSaveMatchEdit(match.id)}
                      >
                        {savingMatchEdit ? "Zapisywanie..." : "Zapisz zmiany"}
                      </button>

                      <button
                        type="button"
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
                        className="ui-btn ui-btn--danger"
                        disabled={loadingMatchDeletePreview}
                        onClick={() => handleOpenDeleteMatch(match.id)}
                      >
                        {loadingMatchDeletePreview &&
                        deletingMatchId === match.id
                          ? "Sprawdzanie..."
                          : "🗑️ Usuń"}
                      </button>
                    </div>
                  </div>
                )}
                <strong>
                  #{match.match_no} {match.team_a} vs {match.team_b}
                </strong>
                <span className="ui-hint">
                  {match.phase} · BO{match.best_of}
                </span>
                <span>
                  Status:{" "}
                  <strong
                    className={`ui-badge ${TON_STATUSU[match.ui_status] ?? ""}`}
                  >
                    {match.ui_status}
                  </strong>
                </span>
                <div>
                  Tryb blokady:{" "}
                  <strong
                    className={`ui-badge ui-badge--${
                      match.lock_override === 1
                        ? "lock"
                        : match.lock_override === 0
                          ? "unlock"
                          : "auto"
                    }`}
                  >
                    {match.lock_override === 1
                      ? "LOCK"
                      : match.lock_override === 0
                        ? "UNLOCK"
                        : "AUTO"}
                  </strong>
                </div>
                <span className="ui-hint">
                  Start:{" "}
                  {match.start_time_utc
                    ? new Date(match.start_time_utc).toLocaleString()
                    : "brak"}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
      {activeAdminSection === "locks" && selectedEvent && (
        <section className="ui-card ui-stack">
          <h2>Locki i deadline&apos;y</h2>

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
                  ? "⛔ Deadline minął"
                  : "🟢 Deadline aktywny"}
              </p>
            )}

            <button type="submit" disabled={savingDeadline || !deadlineValue}>
              {savingDeadline ? "Zapisywanie..." : "Zapisz deadline"}
            </button>

            <button
              type="button"
              onClick={handleClearDeadline}
              disabled={savingDeadline || !deadlineValue}
            >
              Wyczyść deadline
            </button>

            {deadlineMessage && (
              <p
                className={`ui-note ${
                  deadlineMessage.includes("został")
                    ? "ui-note--ok"
                    : "ui-note--danger"
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
          <h2>Wyniki meczów</h2>

          <p>
            Event: <strong>{selectedEvent.name}</strong>
          </p>

          <div className="ui-stack ui-stack--tight">
            {loadingMatches && <Ladowanie>Ładowanie meczów...</Ladowanie>}

            {matchesError && <p>{matchesError}</p>}

            {!loadingMatches && !matchesError && adminMatches.length === 0 && (
              <p>Brak meczów w tym evencie.</p>
            )}

            {adminMatches.map((match) => (
              <div
                key={match.id}
                className="ui-card ui-card--flat ui-card--row ui-card--tight"
              >
                <strong>
                  #{match.match_no} {match.team_a} vs {match.team_b}
                </strong>

                <span className="ui-hint">
                  {match.phase} · BO{match.best_of}
                </span>

                <span>
                  Status:{" "}
                  <strong
                    className={`ui-badge ${TON_STATUSU[match.ui_status] ?? ""}`}
                  >
                    {match.ui_status}
                  </strong>
                </span>

                <div>
                  Tryb blokady:{" "}
                  <strong
                    className={`ui-badge ui-badge--${
                      match.lock_override === 1
                        ? "lock"
                        : match.lock_override === 0
                          ? "unlock"
                          : "auto"
                    }`}
                  >
                    {match.lock_override === 1
                      ? "LOCK"
                      : match.lock_override === 0
                        ? "UNLOCK"
                        : "AUTO"}
                  </strong>
                </div>

                <span className="ui-hint">
                  Start:{" "}
                  {match.start_time_utc
                    ? new Date(match.start_time_utc).toLocaleString()
                    : "brak"}
                </span>

                <span>
                  Wynik:{" "}
                  <strong
                    className={`ui-badge ${
                      match.ui_status === "FINAL"
                        ? "ui-badge--ok"
                        : "ui-badge--warn"
                    }`}
                  >
                    {match.ui_status === "FINAL" ? "USTAWIONY" : "BRAK WYNIKU"}
                  </strong>
                </span>

                <Link to={`/admin/matches/${match.id}/result`}>
                  {match.ui_status === "FINAL"
                    ? "✏️ Edytuj wynik"
                    : "📝 Ustaw wynik"}
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}
      {activeAdminSection === "phases" && selectedEvent && (
        <section className="ui-card ui-stack">
          <h2>Wyniki faz — {selectedEvent.name}</h2>

          <PhaseResultsAdmin slug={selectedEvent.slug} teams={adminTeams} />
        </section>
      )}
      {activeAdminSection === "pickemcfg" && selectedEvent && (
        <section className="ui-card ui-stack">
          <h2>Typowanie drużyn — {selectedEvent.name}</h2>

          <PickemConfigPanel slug={selectedEvent.slug} />
        </section>
      )}
      {activeAdminSection === "mvp" && selectedEvent && (
        <section className="ui-card ui-stack">
          <h2>MVP — {selectedEvent.name}</h2>

          <MvpAdminPanel slug={selectedEvent.slug} />
        </section>
      )}
      {activeAdminSection === "ops" && selectedEvent && (
        <section className="ui-card ui-stack">
          <h2>Operacje turniejowe — {selectedEvent.name}</h2>

          <TournamentOpsPanel
            guildId={selectedServer.guild_id}
            slug={selectedEvent.slug}
          />
        </section>
      )}
      {activeAdminSection === "teams" && selectedServer && (
        <section className="ui-card ui-stack">
          <h2>Zarządzanie drużynami</h2>

          <form className="ui-card ui-stack" onSubmit={handleCreateTeam}>
            <input
              type="text"
              placeholder="Nazwa drużyny"
              value={newTeamName}
              onChange={(event) => setNewTeamName(event.target.value)}
              disabled={creatingTeam}
              required
            />

            <button
              type="submit"
              disabled={creatingTeam || !newTeamName.trim()}
            >
              {creatingTeam ? "Dodawanie..." : "Dodaj drużynę"}
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
            {loadingTeams && <Ladowanie>Ładowanie drużyn...</Ladowanie>}

            {teamsError && <p>{teamsError}</p>}

            {!loadingTeams && !teamsError && adminTeams.length === 0 && (
              <p>Brak drużyn na tym serwerze.</p>
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
                      onClick={() => handleSaveTeamEdit(team.id)}
                      disabled={savingTeamEdit || !editingTeamName.trim()}
                    >
                      {savingTeamEdit ? "Zapisywanie..." : "Zapisz"}
                    </button>

                    <button
                      type="button"
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
                      onClick={() => {
                        setEditingTeamId(team.id);
                        setEditingTeamName(team.name);
                        setTeamEditMessage(null);
                      }}
                    >
                      Edytuj
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleTeamActive(team)}
                      disabled={togglingTeamId === team.id}
                    >
                      {togglingTeamId === team.id
                        ? "Zapisywanie..."
                        : team.active
                          ? "Dezaktywuj"
                          : "Aktywuj"}
                    </button>

                    <button
                      type="button"
                      className="ui-btn ui-btn--danger"
                      onClick={() => handleDeleteTeam(team)}
                      disabled={deletingTeamId === team.id}
                    >
                      {deletingTeamId === team.id ? "Usuwanie..." : "Usuń"}
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
          <h2>Ranking eventu</h2>

          {loadingLeaderboard && <Ladowanie>Ładowanie rankingu...</Ladowanie>}

          {leaderboardError && (
            <p className="ui-note ui-note--danger">{leaderboardError}</p>
          )}

          {!loadingLeaderboard &&
            !leaderboardError &&
            eventLeaderboard.length === 0 && <p>Brak danych rankingowych.</p>}

          {!loadingLeaderboard &&
            !leaderboardError &&
            eventLeaderboard.length > 0 && (
              <div className="admin-leaderboard">
                <div className="admin-leaderboard__header">
                  <span>#</span>
                  <span>Gracz</span>
                  <span>Punkty</span>
                  <span>Seria</span>
                  <span>Mapy</span>
                  <span>Typy</span>
                  <span>Trafione</span>
                  <span>Mapy traf.</span>
                  <span>Exacty</span>
                  <span>Skuteczność</span>
                </div>

                {eventLeaderboard.map((player) => (
                  <div
                    className={`admin-leaderboard__row ${
                      player.rank <= 3
                        ? `admin-leaderboard__row--top-${player.rank}`
                        : ""
                    }`}
                    key={player.user_id}
                  >
                    <span>#{player.rank}</span>

                    <strong>{player.displayname ?? player.user_id}</strong>

                    <span>{Number(player.total_points ?? 0)}</span>

                    <span>{Number(player.series_points ?? 0)}</span>

                    <span>{Number(player.map_points ?? 0)}</span>

                    <span>{Number(player.total_predictions ?? 0)}</span>

                    <span>{Number(player.correct_winners ?? 0)}</span>

                    <span>{Number(player.correct_maps ?? 0)}</span>

                    <span>{Number(player.exact_maps ?? 0)}</span>

                    <span>{Number(player.accuracy ?? 0)}%</span>
                  </div>
                ))}
              </div>
            )}
        </section>
      )}
      <form className="ui-card ui-stack" onSubmit={handleCreateEvent}>
        <h3>Utwórz nowy event</h3>

        <div className="ui-row ui-row--wrap ui-row--full">
          <input
            type="text"
            placeholder="Nazwa eventu"
            value={newEventName}
            onChange={(event) => setNewEventName(event.target.value)}
            disabled={creatingEvent}
            required
          />

          <input
            type="text"
            placeholder="Slug, np. blast-fall-final"
            value={newEventSlug}
            onChange={(event) => setNewEventSlug(event.target.value)}
            disabled={creatingEvent}
            pattern="[a-z0-9-]+"
            title="Tylko małe litery, cyfry i myślniki"
            required
          />

          <button
            type="submit"
            disabled={
              creatingEvent || !newEventName.trim() || !newEventSlug.trim()
            }
          >
            {creatingEvent ? "Tworzenie..." : "Utwórz event"}
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
        ← Powrót
      </Link>
    </div>
  );
}
