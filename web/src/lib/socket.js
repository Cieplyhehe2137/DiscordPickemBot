import { io } from "socket.io-client";

// Bez argumentu socket.io łączy się z originem, z którego pobrano stronę -
// to działa, dopóki front i API stoją na tym samym hoście.
//
// Gdy front idzie na osobny host (Cloudflare Pages), trzeba wskazać adres
// API wprost, bo pod adresem Pages nie ma serwera socket.io.
const API_URL = String(import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

const socket = API_URL
  ? io(API_URL, { withCredentials: true })
  : io({ withCredentials: true });

export default socket;
