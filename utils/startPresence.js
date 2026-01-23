let presenceStarted = false;
let presenceInterval = null;

module.exports = (client) => {
  if (presenceStarted) return;
  presenceStarted = true;

  if (!client?.user) {
    console.warn('[presence] client.user not ready, skipping presence setup');
    return;
  }

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

  // losowy start
  let i = Math.floor(Math.random() * activities.length);

  const setStatus = (text) => {
    try {
      client.user.setPresence({
        activities: [{ name: text, type: 4 }], // Custom status
        status: 'online',
      });
    } catch (err) {
      console.warn('[presence] Failed to set presence:', err.message);
    }
  };

  // ustaw od razu
  setStatus(activities[i % activities.length]);
  i++;

  presenceInterval = setInterval(() => {
    setStatus(activities[i % activities.length]);
    i++;
  }, 30_000);
};
