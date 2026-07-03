"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const WORKER_URL = "http://127.0.0.1:8787";

interface Room {
  slug: string;
  name: string;
  question: string;
  created_at: number;
}

export default function Lobby() {
  const [rooms, setRooms] = useState<Room[]>([]);

  useEffect(() => {
    fetch(`${WORKER_URL}/api/rooms`)
      .then((res) => res.json())
      .then((data) => setRooms(data.rooms || []));
  }, []);

  return (
    <main className="max-w-xl mx-auto py-16 px-6">
      <h1 className="text-2xl font-mono mb-8">chat.albinjojo.me</h1>
      {rooms.length === 0 ? (
        <p className="text-sm text-neutral-500">No rooms yet.</p>
      ) : (
        rooms.map((r) => (
          <Link
            key={r.slug}
            href={`/r/${r.slug}`}
            className="block border p-4 rounded mb-3"
          >
            {r.name}
          </Link>
        ))
      )}
    </main>
  );
}