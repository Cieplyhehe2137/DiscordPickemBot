// Stan ładowania.
//
// Do tej pory każde miejsce renderowało goły akapit bez klasy, więc nie dało
// się tego ostylować inaczej niż regułą na wszystkie akapity w aplikacji.
// Teksty były drobne i ginęły na środku pustej strony.
//
// role="status" z aria-live sprawia, że czytnik ekranu ogłasza zmianę stanu,
// zamiast milczeć, dopóki treść się nie pojawi.

function Ladowanie({ children = "Ładowanie..." }) {
  return (
    <p className="ladowanie" role="status" aria-live="polite">
      <span className="ladowanie__kolko" aria-hidden="true" />

      <span className="ladowanie__tekst">{children}</span>
    </p>
  );
}

export default Ladowanie;
