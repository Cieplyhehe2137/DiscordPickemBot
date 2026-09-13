import { Link } from "react-router-dom";

// Osiem podstron nie miało żadnego linku powrotnego - jedynym wyjściem był
// przycisk "wstecz" w przeglądarce. Komponent Breadcrumbs, który to kiedyś
// obsługiwał, zniknął przy przepisywaniu frontu.
//
// Wygląd bierze się z design systemu (ui-btn--ghost), a nie z własnej klasy.
// Wcześniej stała tu `matches-page__back` - goły tekst wysokości 21 px - a
// MatchesPage i LeaderboardPage zdążyły w międzyczasie przejść na ui-btn.
// Ten sam element w dwóch wersjach na sąsiednich ekranach: raz napis, raz
// przycisk. Komentarz obiecywał tu jeden wzorzec i przestał być prawdą.
function BackLink({ to, children = "Wróć do eventu" }) {
  return (
    <Link className="ui-btn ui-btn--ghost ui-btn--sm page-back" to={to}>
      ← {children}
    </Link>
  );
}

export default BackLink;
