// Zaznaczanie wielu pozycji na liście.
//
// Wyciągnięte z panelu MVP, bo to jedyny fragment tamtego widoku, który ma
// przypadki brzegowe: grupa zaznaczona częściowo, grupa pusta, ta sama
// pozycja w dwóch grupach. W pliku .jsx nie da się tego przetestować bez
// transformacji JSX, a tutaj testuje się bez żadnej.
//
// Wszystkie funkcje ZWRACAJĄ NOWY zbiór zamiast zmieniać podany. React
// porównuje stan po tożsamości, więc mutacja Seta w miejscu nie wywołałaby
// ponownego renderu i zaznaczenie nie pojawiłoby się na ekranie.

export function toggleSelected(selected, id) {
  const next = new Set(selected);

  if (next.has(id)) next.delete(id);
  else next.add(id);

  return next;
}

// Pusta grupa NIE jest "cała zaznaczona" - inaczej nagłówek grupy bez pozycji
// pokazywałby zaznaczony checkbox, a kliknięcie go nie robiłoby nic.
export function isGroupSelected(selected, ids) {
  return ids.length > 0 && ids.every((id) => selected.has(id));
}

// Grupa zaznaczona częściowo ma się DOZNACZYĆ, a nie odznaczyć: kliknięcie
// "zaznacz wszystkie" przy trzech z dziesięciu znaczy "chcę wszystkie".
// Odznaczanie następuje dopiero, gdy zaznaczone są już wszystkie.
export function toggleGroup(selected, ids) {
  const next = new Set(selected);
  const wszystkie = isGroupSelected(selected, ids);

  for (const id of ids) {
    if (wszystkie) next.delete(id);
    else next.add(id);
  }

  return next;
}
