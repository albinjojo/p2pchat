const WORKER_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8787";
const WS_URL = WORKER_URL.replace(/^http/, "ws");

export interface ChatConnection {
  peer: RTCPeerConnection;
  channel: RTCDataChannel;
  close: () => void;
}

const pendingQueues = new WeakMap<ChatConnection, string[]>();

/**
 * Guest-side connection: a guest always has exactly one RTCPeerConnection,
 * to the owner. The owner's session id arrives via the DO's `peer-joined`
 * message on connect; every signaling message the guest sends afterward
 * must be addressed `to` that id, since the Durable Object only relays
 * messages that carry an explicit recipient.
 */
export async function connectToRoom(
  slug: string,
  access: string | undefined,
  onMessage: (text: string) => void,
  onOpen: () => void,
  maxGuests?: number
): Promise<ChatConnection> {
  const params = new URLSearchParams({ role: "guest" });
  if (access) params.set("access", access);
  if (maxGuests) params.set("max", String(maxGuests + 1));
  const ws = new WebSocket(`${WS_URL}/api/rooms/${slug}/ws?${params}`);

  const peer = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.cloudflare.com:3478" }],
  });

  const queue: string[] = [];
  let channel: RTCDataChannel;
  let ownerId: string | null = null;

  function flushQueue() {
    if (channel?.readyState === "open") {
      for (const text of queue.splice(0)) {
        channel.send(text);
      }
    }
  }

  function handleChannelOpen() {
    onOpen();
    flushQueue();
  }

  peer.onicecandidate = (event) => {
    if (event.candidate && ownerId) {
      ws.send(JSON.stringify({ type: "ice", candidate: event.candidate, to: ownerId }));
    }
  };

  peer.ondatachannel = (event) => {
    channel = event.channel;
    setupChannel(channel, onMessage, handleChannelOpen);
  };

  ws.onmessage = async (event) => {
    const msg = JSON.parse(event.data);

    // The only message that ever tells us the owner's id. Sent once, right
    // when we connect (whether the owner was already here or arrives later).
    if (msg.type === "peer-joined") {
      ownerId = msg.peerId;
      return;
    }

    if (msg.type === "offer") {
      if (peer.signalingState === "stable" || peer.signalingState === "have-remote-offer") {
        await peer.setRemoteDescription(msg.offer);
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        if (ownerId) {
          ws.send(JSON.stringify({ type: "answer", answer, to: ownerId }));
        }
      }
    }

    if (msg.type === "ice") {
      await peer.addIceCandidate(msg.candidate);
    }
  };

  const connection: ChatConnection = {
    peer,
    get channel() {
      return channel;
    },
    close: () => {
      channel?.close();
      peer.close();
      ws.close();
    },
  } as ChatConnection;

  pendingQueues.set(connection, queue);
  return connection;
}

function setupChannel(
  channel: RTCDataChannel,
  onMessage: (text: string) => void,
  onOpen: () => void
) {
  channel.onopen = onOpen;
  channel.onmessage = (event) => onMessage(event.data);
}

export function sendMessage(connection: ChatConnection, text: string) {
  if (connection.channel?.readyState === "open") {
    connection.channel.send(text);
  } else {
    pendingQueues.get(connection)?.push(text);
  }
}

export interface OwnerConnection {
  sendToAll: (text: string) => void;
  close: () => void;
}

interface GuestPeer {
  peer: RTCPeerConnection;
  channel: RTCDataChannel;
  nickname: string;
  queue: string[];
}

/**
 * Owner-side connection manager for multi-guest rooms: one WebSocket to the
 * Durable Object multiplexes signaling for N independent RTCPeerConnections,
 * one per guest, addressed by the sessionId the DO assigns each guest.
 *
 * Group-chat forwarding lives here rather than in the caller: a guest's text
 * message is displayed via `onGuestMessage` *and* relayed to every other
 * guest's data channel, tagged with that guest's nickname (tracked locally
 * per Map entry, since it's already needed here for forwarding).
 */
export async function connectOwnerToRoom(
  slug: string,
  maxGuests: number | undefined,
  onGuestMessage: (guestId: string, nickname: string, text: string) => void,
  onGuestLeave: (guestId: string) => void
): Promise<OwnerConnection> {
  const params = new URLSearchParams({ role: "owner" });
  if (maxGuests) params.set("max", String(maxGuests + 1));
  const ws = new WebSocket(`${WS_URL}/api/rooms/${slug}/ws?${params}`);

  const guestPeers = new Map<string, GuestPeer>();

  function flush(gp: GuestPeer) {
    if (gp.channel.readyState === "open") {
      for (const text of gp.queue.splice(0)) {
        gp.channel.send(text);
      }
    }
  }

  function forwardToOthers(senderId: string, text: string, nickname: string) {
    const relayed = JSON.stringify({ type: "text", text, from: nickname });
    for (const [guestId, gp] of guestPeers) {
      if (guestId === senderId) continue;
      if (gp.channel.readyState === "open") gp.channel.send(relayed);
      else gp.queue.push(relayed);
    }
  }

  function getOrCreatePeer(guestId: string): GuestPeer {
    const existing = guestPeers.get(guestId);
    if (existing) return existing;

    const peer = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.cloudflare.com:3478" }],
    });
    const channel = peer.createDataChannel("chat");
    const gp: GuestPeer = { peer, channel, nickname: "", queue: [] };

    channel.onopen = () => flush(gp);
    channel.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "nickname") {
        gp.nickname = data.nickname;
      } else if (data.type === "text") {
        onGuestMessage(guestId, gp.nickname, data.text);
        forwardToOthers(guestId, data.text, gp.nickname || "them");
      }
    };

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        ws.send(JSON.stringify({ type: "ice", candidate: event.candidate, to: guestId }));
      }
    };

    guestPeers.set(guestId, gp);
    return gp;
  }

  ws.onmessage = async (event) => {
    const msg = JSON.parse(event.data);
    const guestId: string | undefined = msg.peerId ?? msg.from;
    if (!guestId) return;

    if (msg.type === "peer-joined") {
      const gp = getOrCreatePeer(guestId);
      if (gp.peer.signalingState === "stable") {
        const offer = await gp.peer.createOffer();
        await gp.peer.setLocalDescription(offer);
        ws.send(JSON.stringify({ type: "offer", offer, to: guestId }));
      }
    }

    if (msg.type === "peer-left") {
      const gp = guestPeers.get(guestId);
      gp?.channel.close();
      gp?.peer.close();
      guestPeers.delete(guestId);
      onGuestLeave(guestId);
    }

    if (msg.type === "answer") {
      const gp = guestPeers.get(guestId);
      if (gp && gp.peer.signalingState === "have-local-offer") {
        await gp.peer.setRemoteDescription(msg.answer);
      }
    }

    if (msg.type === "ice") {
      const gp = guestPeers.get(guestId);
      if (gp) await gp.peer.addIceCandidate(msg.candidate);
    }
  };

  function sendToAll(text: string) {
    for (const gp of guestPeers.values()) {
      if (gp.channel.readyState === "open") gp.channel.send(text);
      else gp.queue.push(text);
    }
  }

  return {
    sendToAll,
    close: () => {
      for (const gp of guestPeers.values()) {
        gp.channel.close();
        gp.peer.close();
      }
      ws.close();
    },
  };
}
