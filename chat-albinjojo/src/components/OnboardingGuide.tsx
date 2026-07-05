"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";

// Self-hosted from public/ — lottie.host's CDN link serves this file with no
// Access-Control-Allow-Origin header, so a cross-origin fetch() from the
// browser is silently blocked by CORS and the animation never loads.
const WALK_ANIMATION_SRC = "/onboarding-walk.lottie";

const MESSAGES = [
  "Heyy! Welcome to chat.albinjojo.me 👋",
  "Here you can chat with Albin — directly, no signup needed.",
  "See a room below? That's a question only someone who knows Albin could answer.",
  "Pick one, answer correctly, and you're in — a real, live conversation.",
  "Set your own nickname, stay anonymous otherwise.",
  "Turn on Vanish Mode and your messages disappear after you read them.",
  "Everything is peer-to-peer — nothing is ever saved on any server.",
  "Give it a try!",
];

export function OnboardingGuide({ hidden = false }: { hidden?: boolean }) {
  const [dismissed, setDismissed] = useState(false);
  const [messageIndex, setMessageIndex] = useState(0);

  if (hidden || dismissed) return null;

  function advance() {
    setMessageIndex((i) => (i + 1) % MESSAGES.length);
  }

  const isLast = messageIndex === MESSAGES.length - 1;

  return (
    <section className="mt-4 flex flex-col items-center">
      <div className="hard-panel relative mb-3 w-full max-w-md p-6">
        <button
          onClick={() => setDismissed(true)}
          aria-label="Skip intro"
          className="absolute -right-2.5 -top-2.5 flex h-8 w-8 items-center justify-center rounded-full border-2 border-ink bg-white font-mono text-sm font-bold shadow-[1.5px_1.5px_0_0_var(--ink)]"
        >
          ×
        </button>

        <AnimatePresence mode="wait">
          <motion.p
            key={messageIndex}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="font-sans text-base leading-snug text-ink"
          >
            {MESSAGES[messageIndex]}
          </motion.p>
        </AnimatePresence>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex gap-1.5">
            {MESSAGES.map((_, i) => (
              <span
                key={i}
                className={`h-2 w-2 rounded-full ${
                  i === messageIndex ? "bg-orange" : "bg-ink/15"
                }`}
              />
            ))}
          </div>
          <button onClick={advance} className="hard-btn">
            {isLast ? "Got it!" : "Next →"}
          </button>
        </div>

        <div
          className="absolute left-1/2 top-full h-5 w-5 -translate-x-1/2 -translate-y-2.5 rotate-45 border-b-2 border-r-2 border-ink bg-white"
          aria-hidden
        />
      </div>

      <div className="h-[220px] w-[220px] sm:h-[280px] sm:w-[280px]" aria-hidden>
        <DotLottieReact
          src={WALK_ANIMATION_SRC}
          loop
          autoplay
          layout={{ fit: "cover", align: [0.5, 0.5] }}
        />
      </div>
    </section>
  );
}
