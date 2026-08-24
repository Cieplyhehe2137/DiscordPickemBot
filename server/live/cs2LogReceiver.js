import dgram from "node:dgram";

export function startCs2LogReceiver({ port = 27500, onLine } = {}) {
  const server = dgram.createSocket("udp4");

  server.on("error", (err) => {
    console.error("[CS2 LOG RECEIVER ERROR]", err);
    server.close();
  });

  server.on("message", (msg, rinfo) => {
    const raw = msg.toString("utf8").trim();

    if (!raw) return;

    console.log("[CS2 LOG]", {
      from: `${rinfo.address}:${rinfo.port}`,
      raw,
    });

    if (typeof onLine === "function") {
      onLine(raw, rinfo);
    }
  });

  server.on("listening", () => {
    const address = server.address();

    console.log(
      `[CS2 LOG RECEIVER] listening on ${address.address}:${address.port}`,
    );
  });

  server.bind(port, "0.0.0.0");

  return server;
}
