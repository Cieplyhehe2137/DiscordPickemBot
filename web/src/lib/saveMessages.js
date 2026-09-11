// Komunikat po udanym zapisie typów fazy.
//
// Strony faz trzymają jeden stan na komunikat: raz wpada tam potwierdzenie,
// raz treść błędu z backendu. Dopóki oba wyglądały tak samo, nie dało się
// pokolorować ich różnie. Porównanie do tej stałej jest dokładne - zgadywanie
// po fragmencie tekstu ("czy zawiera ✅") łamałoby się przy pierwszym błędzie,
// który przypadkiem ma w treści to samo słowo.

export const SAVED_MESSAGE = "Typy zapisane ✅";
