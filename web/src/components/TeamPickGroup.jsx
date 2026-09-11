import PickCounter from "./PickCounter.jsx";

// Jedna grupa typów: tytuł, licznik i siatka drużyn do klikania.
//
// Fazy szwajcarska i double elimination miały po trzy i cztery takie bloki,
// przepisane w kółko - różniły się tylko tytułem, limitem i tym, które
// drużyny są już zajęte przez wcześniejsze grupy.
//
// Drużyna niedostępna jest wyłączona, a nie po cichu ignorowana. Wcześniej
// klikanie w komplet po prostu nic nie robiło, więc wyglądało jak zepsuty
// przycisk.

function TeamPickGroup({
  title,
  description,
  teams,
  selected,
  limit,
  isBlocked = () => false,
  onToggle,
  disabled = false,
}) {
  return (
    <section className="ui-card ui-stack">
      <div className="ui-section-head">
        <div>
          <span className="ui-kicker">{title}</span>

          {description && <p>{description}</p>}
        </div>
      </div>

      <PickCounter selected={selected.length} limit={limit} />

      <div className="ui-choice ui-choice--grid">
        {teams?.map((team) => {
          const isSelected = selected.includes(team.name);

          return (
            <button
              key={team.id}
              type="button"
              className="ui-choice__option"
              aria-pressed={isSelected}
              disabled={
                disabled ||
                (!isSelected &&
                  (selected.length >= limit || isBlocked(team.name)))
              }
              onClick={() => onToggle(team.name)}
            >
              {team.name}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default TeamPickGroup;
