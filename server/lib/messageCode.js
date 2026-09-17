// Kod komunikatu - ale tylko wtedy, gdy komunikat jest NASZ.
//
// Część odpowiedzi niesie zdanie, które może pochodzić z dwóch miejsc:
// z konfiguracji serwera Discord (administrator wpisał własny powód blokady)
// albo z naszego zdania zapasowego. Tłumaczyć wolno wyłącznie to drugie -
// cudzego zdania nie ma w żadnym słowniku i nie ma jak go przetłumaczyć,
// a podmiana go na nasze ogólne "Typowanie jest zamknięte" zjadłaby
// informację, którą administrator napisał specjalnie.
//
// Stąd ta funkcja: kod wraca tylko wtedy, gdy na ekran idzie dokładnie nasze
// zdanie zapasowe. W przeciwnym razie `null`, a strona pokazuje to, co
// przyszło - patrz web/src/lib/apiMessages.js.

export function codeForDefault(tresc, domyslna, kod) {
  return tresc === domyslna ? kod : null;
}
