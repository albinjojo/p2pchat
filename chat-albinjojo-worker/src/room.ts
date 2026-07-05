interface Session {
  ws: WebSocket;
}

export class RoomSignal {
  sessions: Session[] = [];
  maxSessions: number = 2;

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }

    const url = new URL(request.url);
    const role = url.searchParams.get("role");
    const maxParam = url.searchParams.get("max");

    if (role === "owner" && maxParam) {
      this.maxSessions = parseInt(maxParam, 10) || 2;
    }

    if (this.sessions.length >= this.maxSessions) {
      return new Response("Room full", { status: 409 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
    server.accept();

    const session: Session = { ws: server };
    this.sessions.push(session);

    // The moment the room has both parties, tell them both. Whichever one
    // was already connected and waiting learns a peer just arrived; the one
    // that just connected learns a peer was already there. Either way, both
    // sides now know it's safe to start the WebRTC offer/answer handshake —
    // no more racing an offer against a guest who hasn't joined yet.
    if (this.sessions.length === 2) {
      for (const s of this.sessions) {
        s.ws.send(JSON.stringify({ type: "peer-joined" }));
      }
    }

   server.addEventListener("message", (event) => {
      for (const other of this.sessions) {
        if (other !== session) other.ws.send(event.data as string);
      }
    });

   server.addEventListener("close", () => {
      this.sessions = this.sessions.filter((s) => s !== session);
    });

    return new Response(null, { status: 101, webSocket: client });
  }
}