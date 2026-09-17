import { Link, useLocation } from "react-router-dom";

import { T } from "../i18n/T.jsx";
import { useT } from "../i18n/useLanguage.js";

// Bez tej strony każdy adres spoza listy route'ów renderował sam layout
// z pustą treścią - biała strona bez komunikatu i bez drogi powrotu.
// Dotyczy to również starych linków po zmianie struktury URL.
function NotFoundPage() {
  const location = useLocation();

  const t = useT();

  return (
    <main className="ui-page ui-page--narrow">
      <div className="ui-empty">
        <span className="ui-empty__icon" aria-hidden="true">
          🧭
        </span>

        <span className="ui-kicker">{t("notFound.kicker")}</span>

        <strong className="ui-empty__title">{t("notFound.title")}</strong>

        <p className="ui-empty__text">
          <T
            k="notFound.text"
            vars={{ path: <code>{location.pathname}</code> }}
          />
        </p>

        <div className="ui-row ui-row--wrap">
          <Link className="ui-btn ui-btn--primary" to="/events">
            {t("notFound.events")}
          </Link>

          <Link className="ui-btn ui-btn--ghost" to="/">
            {t("notFound.home")}
          </Link>
        </div>
      </div>
    </main>
  );
}

export default NotFoundPage;
