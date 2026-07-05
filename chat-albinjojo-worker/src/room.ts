interface Session {
  id: string;
  ws: WebSocket;
  role: "owner" | "guest" | null;
}

interface SignalMessage {
  to?: string;
  [key: string]: unknown;
}

export class RoomSignal {
  sessions: Session[] = [];

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }

    const url = new URL(request.url);
    const role = url.searchParams.get("role") as "owner" | "guest" | null;

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
    server.accept();

    const id = crypto.randomUUID();
    const session: Session = { id, ws: server, role };
    this.sessions.push(session);

    if (role === "guest") {
      const owner = this.sessions.find((s) => s.role === "owner");
      if (owner) {
        owner.ws.send(JSON.stringify({ type: "peer-joined", peerId: id }));
        session.ws.send(JSON.stringify({ type: "peer-joined", peerId: owner.id }));
      }
    } else if (role === "owner") {
      const existingGuests = this.sessions.filter((s) => s.role === "guest");
      for (const guest of existingGuests) {
        session.ws.send(JSON.stringify({ type: "peer-joined", peerId: guest.id }));
      }
    }

    server.addEventListener("message", (event) => {
      let msg: SignalMessage;
      try {
        msg = JSON.parse(event.data as string);
      } catch {
        return;
      }

      const target = this.sessions.find((s) => s.id === msg.to);
      target?.ws.send(JSON.stringify({ ...msg, from: session.id }));
    });

    server.addEventListener("close", () => {
      this.sessions = this.sessions.filter((s) => s !== session);

      if (session.role === "guest") {
        const owner = this.sessions.find((s) => s.role === "owner");
        owner?.ws.send(JSON.stringify({ type: "peer-left", peerId: session.id }));
      }
    });

    return new Response(null, { status: 101, webSocket: client });
  }
}
