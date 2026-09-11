// Ekran za logowaniem: "moje typy", "moje statystyki".
//
// Brak logowania to nie awaria, tylko brama - a wcześniej trafiał w to samo
// czerwone pudełko co błąd serwera, razem z komunikatem "Musisz być
// zalogowany.". Tutaj jest stan pusty z jednym oczywistym przyciskiem.

function LoginRequired({ children }) {
  const returnTo = encodeURIComponent(
    window.location.pathname + window.location.search,
  );

  return (
    <div className="ui-empty">
      <span className="ui-empty__icon" aria-hidden="true">
        🔐
      </span>

      <strong className="ui-empty__title">Zaloguj się, żeby zobaczyć</strong>

      <p className="ui-empty__text">{children}</p>

      <a
        className="ui-btn ui-btn--primary"
        href={`/api/auth/discord?returnTo=${returnTo}`}
      >
        Zaloguj przez Discord
      </a>
    </div>
  );
}

export default LoginRequired;
