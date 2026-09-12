import { httpServer } from "./server/app.js";

const PORT = Number(process.env.PORT || 3301);

httpServer.listen(PORT, () => {
  console.log(`[WEB] API server listening on port ${PORT}`);
});