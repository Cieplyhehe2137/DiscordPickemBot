// Displays internal English enum values (event.status, event.phase, match
// lock state) in Polish. The underlying values stay in English - they're
// compared against literals elsewhere and sent back to the API - only the
// rendered text changes.

const STATUS_LABELS = {
  OPEN: "OTWARTY",
  CLOSED: "ZAMKNIĘTY",
  ARCHIVED: "ZARCHIWIZOWANY",
  LOCKED: "ZABLOKOWANY",
};

const PHASE_LABELS = {
  NOT_STARTED: "NIEROZPOCZĘTA",
  PLAY_IN: "PLAY-IN",
  SWISS: "SWISS",
  PLAYOFFS: "PLAYOFFS",
  FINISHED: "ZAKOŃCZONA",
  UNKNOWN: "NIEZNANA",
};

export function translateStatus(status) {
  return STATUS_LABELS[status] || status;
}

export function translatePhase(phase) {
  return PHASE_LABELS[phase] || phase;
}
