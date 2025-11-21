const { scrapeEvent } = require("./utils/scrapeHLTV");

(async () => {
  const data = await scrapeEvent(7741);
  console.log(JSON.stringify(data, null, 2));
})();
