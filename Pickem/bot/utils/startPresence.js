module.exports = (client) => {
  const activities = [
    "Sprawdza twoje typy Pick'Em 🎯",
    "Liczy punkty w Swiss 🧮",
    "💼 Typy na playoffy w toku...",
    "Double Elim? Easy 😎",
    "Przegrywa Pick'Em tak jak Ty 😂",
    "Dostał eco od ciebie... 💸",
    "Czeka na typy od Paudera 🐐",
    "Prowadzi w tabeli... chyba 😅",
    "Pamiętaj o deadlinie ⏰",
    "🤔 Czy Pauder znów zaskoczy?",
    "🚨 Deadline coraz bliżej!",
    "😎 Pewniaczki Seby"
  ];

  let i = 0;
  setInterval(() => {
    const status = activities[i % activities.length];
    client.user.setPresence({
      activities: [{ name: status, type: 4 }],
      status: 'online'
    });
    i++;
  }, 30000);
}
