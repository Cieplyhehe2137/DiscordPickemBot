import { Link, useLocation } from "react-router-dom";

// Bez tej strony każdy adres spoza listy route'ów renderował sam layout
// z pustą treścią - biała strona bez komunikatu i bez drogi powrotu.
// Dotyczy to również starych linków po zmianie struktury URL.
function NotFoundPage() {
  const location = useLocation();

  return (
    <main className="notfound-page">
      <span className="events-kicker">Błąd 404</span>

      <h1>Nie ma takiej strony</h1>

      <p className="notfound-page__lead">
        Adres <code className="notfound-page__url">{location.pathname}</code> nie
        istnieje. Mógł się zdezaktualizować albo zawierać literówkę.
      </p>

      <div className="notfound-page__actions">
        <Link className="home-button home-button--primary" to="/events">
          Zobacz turnieje
        </Link>

        <Link className="home-button home-button--secondary" to="/">
          Strona główna
        </Link>
      </div>
    </main>
  );
}

export default NotFoundPage;
