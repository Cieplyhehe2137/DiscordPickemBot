import { Link, useLocation } from "react-router-dom";

// Bez tej strony każdy adres spoza listy route'ów renderował sam layout
// z pustą treścią - biała strona bez komunikatu i bez drogi powrotu.
// Dotyczy to również starych linków po zmianie struktury URL.
function NotFoundPage() {
  const location = useLocation();

  return (
    <main className="ui-page ui-page--narrow">
      <div className="ui-empty">
        <span className="ui-empty__icon" aria-hidden="true">
          🧭
        </span>

        <span className="ui-kicker">Błąd 404</span>

        <strong className="ui-empty__title">Nie ma takiej strony</strong>

        <p className="ui-empty__text">
          Adres <code>{location.pathname}</code> nie istnieje. Mógł się
          zdezaktualizować albo zawierać literówkę.
        </p>

        <div className="ui-row ui-row--wrap">
          <Link className="ui-btn ui-btn--primary" to="/events">
            Zobacz turnieje
          </Link>

          <Link className="ui-btn ui-btn--ghost" to="/">
            Strona główna
          </Link>
        </div>
      </div>
    </main>
  );
}

export default NotFoundPage;
