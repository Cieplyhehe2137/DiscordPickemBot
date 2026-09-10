import { Link } from "react-router-dom";

// Osiem podstron nie miało żadnego linku powrotnego - jedynym wyjściem był
// przycisk "wstecz" w przeglądarce. Komponent Breadcrumbs, który to kiedyś
// obsługiwał, zniknął przy przepisywaniu frontu.
//
// Wzorzec klasy jest ten sam co w MatchesPage i LeaderboardPage
// (matches-page__back), żeby nie mnożyć stylów pod to samo.
function BackLink({ to, children = "Wróć do eventu" }) {
  return (
    <Link className="matches-page__back" to={to}>
      ← {children}
    </Link>
  );
}

export default BackLink;
