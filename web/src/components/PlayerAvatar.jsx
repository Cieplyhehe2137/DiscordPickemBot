// Awatar gracza z inicjałem jako zapasem.
//
// Awatara nie ma dziś 1108 z 1110 graczy - wiersz w `user_profiles` powstaje
// dopiero przy logowaniu na stronie, a większość typuje wyłącznie na
// Discordzie. Inicjał jest więc widokiem domyślnym, nie wyjątkiem, i musi
// zajmować dokładnie tyle samo miejsca co obrazek, żeby listy nie falowały.
//
// Rozmiar podaje się pełną nazwą klasy ("ui-avatar--lg"), a nie samym
// przyrostkiem. Sklejanie `ui-avatar--${size}` sprawiłoby, że nazwa nie
// występuje w kodzie dosłownie i narzędzie do usuwania martwego CSS
// skasowałoby te reguły jako nieużywane.

function PlayerAvatar({ userId, avatar, name, size = "", lazy = true }) {
  if (avatar) {
    return (
      <img
        className={`ui-avatar ${size}`.trim()}
        src={`https://cdn.discordapp.com/avatars/${userId}/${avatar}.png?size=128`}
        alt=""
        loading={lazy ? "lazy" : undefined}
      />
    );
  }

  return (
    <span className={`ui-avatar ui-avatar--initials ${size}`.trim()}>
      {name?.[0]?.toUpperCase() ?? "?"}
    </span>
  );
}

export default PlayerAvatar;
