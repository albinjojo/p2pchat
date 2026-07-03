interface Session {
  ws: WebSocket;
}

export class RoomSignal {
  sessions: Session[] = [];

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }

    if (this.sessions.length >= 2) {
      return new Response("Room full", { status: 409 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
    server.accept();

    const session: Session = { ws: server };
    this.sessions.push(session);
    console.log(`Session joined. Total sessions: ${this.sessions.length}`);

    server.addEventListener("message", (event) => {
      const other = this.sessions.find((s) => s !== session);
      if (other) other.ws.send(event.data as string);
    });

    server.addEventListener("close", () => {
      this.sessions = this.sessions.filter((s) => s !== session);
      console.log(`Session left. Total sessions: ${this.sessions.length}`);
    });

    return new Response(null, { status: 101, webSocket: client });
  }
}