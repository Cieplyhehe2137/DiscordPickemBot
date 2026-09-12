(async () => {
  try {
    const { httpServer } = await import("./server/app.js");

    const PORT = Number(process.env.PORT || 3301);

    httpServer.listen(PORT, () => {
      console.log(`[WEB] API server listening on port ${PORT}`);
    });
  } catch (error) {
    console.error("[WEB] Failed to start API:", error);
    process.exit(1);
  }
})();