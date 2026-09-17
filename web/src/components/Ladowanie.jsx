// Stan ładowania.
//
// Do tej pory każde miejsce renderowało goły akapit bez klasy, więc nie dało
// się tego ostylować inaczej niż regułą na wszystkie akapity w aplikacji.
// Teksty były drobne i ginęły na środku pustej strony.
//
import { useT } from "../i18n/useLanguage.js";

// role="status" z aria-live sprawia, że czytnik ekranu ogłasza zmianę stanu,
// zamiast milczeć, dopóki treść się nie pojawi.

function Ladowanie({ children }) {
  const t = useT();

  return (
    <p className="ui-loader" role="status" aria-live="polite">
      <span className="ui-loader__spinner" aria-hidden="true" />

      <span className="ui-loader__text">
        {children ?? t("common.loading")}
      </span>
    </p>
  );
}

export default Ladowanie;
