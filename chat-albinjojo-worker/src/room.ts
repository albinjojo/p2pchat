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