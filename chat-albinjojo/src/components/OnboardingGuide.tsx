"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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

type Stage = "hidden" | "walking-in" | "talking" | "leaving";

export function OnboardingGuide() {
  const [stage, setStage] = useState<Stage>("hidden");
  const [messageIndex, setMessageIndex] = useState(0);
  // Bumped each time the walk-in restarts, forcing the motion.div to remount
  // so its `initial` (off-screen) position is re-applied for a fresh slide-in
  // instead of just fading back in from wherever it already is.
  const [loopKey, setLoopKey] = useState(0);

  useEffect(() => {
    setStage("walking-in");
  }, []);

  function advance() {
    setMessageIndex((i) => {
      if (i >= MESSAGES.length - 1) {
        setStage("leaving");
        return i;
      }
      return i + 1;
    });
  }

  function dismiss() {
    setStage("hidden");
  }

  function restartLoop() {
    setMessageIndex(0);
    setLoopKey((k) => k + 1);
    setStage("walking-in");
  }

  if (stage === "hidden") return null;

  const isLast = messageIndex === MESSAGES.length - 1;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 h-0">
      <motion.div
        key={loopKey}
        className="pointer-events-auto fixed"
        style={{ left: "50%", bottom: "-100px" }}
        initial={{ x: "calc(-50% - 100vw)", opacity: 1 }}
        animate={
          stage === "leaving"
            ? { x: "-50%", opacity: 0 }
            : { x: "-50%", y: [0, -10, 0, -10, 0, -10, 0], opacity: 1 }
        }
        transition={
          stage === "leaving"
            ? { duration: 0.6, ease: "easeInOut" }
            : stage === "walking-in"
            ? {
                x: { duration: 1.6, ease: "easeOut" },
                y: {
                  duration: 1.6,
                  ease: "easeInOut",
                  times: [0, 0.16, 0.33, 0.5, 0.66, 0.83, 1],
                },
              }
            : { duration: 0.2 }
        }
        onAnimationComplete={() => {
          if (stage === "walking-in") setStage("talking");
          if (stage === "leaving") restartLoop();
        }}
      >
        <AnimatePresence>
          {stage === "talking" && (
            <motion.div
              key={messageIndex}
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.2 }}
              className="hard-panel absolute right-full top-1/3 mr-6 w-[280px] -translate-y-1/2 p-5 sm:w-[340px]"
            >
              <button
                onClick={dismiss}
                aria-label="Skip intro"
                className="absolute -right-2.5 -top-2.5 flex h-8 w-8 items-center justify-center rounded-full border-2 border-ink bg-white font-mono text-sm font-bold shadow-[1.5px_1.5px_0_0_var(--ink)]"
              >
                ×
              </button>

              <p className="font-sans text-base leading-snug text-ink">
                {MESSAGES[messageIndex]}
              </p>

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
                className="absolute left-full top-1/2 h-6 w-6 -translate-x-3 -translate-y-1/2 -rotate-45 border-b-2 border-r-2 border-ink bg-white"
                aria-hidden
              />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="h-[500px] w-[500px]" aria-hidden>
          <DotLottieReact src={WALK_ANIMATION_SRC} loop autoplay />
        </div>
      </motion.div>
    </div>
  );
}
