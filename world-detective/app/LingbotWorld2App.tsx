"use client";

import { useState } from "react";
import {
  LingbotWorld2MainVideoView,
  LingbotWorld2Provider,
  useLingbotWorld2,
} from "@reactor-models/lingbot-world-2";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { SnapClip } from "@/components/SnapClip";
import { LingbotWorldController } from "@/components/lingbot-world-2/LingbotWorldController";

// Reactor Platform the SDK connects to. Override with
// NEXT_PUBLIC_REACTOR_API_URL in .env.local if you need a different one.
const API_URL =
  process.env.NEXT_PUBLIC_REACTOR_API_URL ?? "https://api.reactor.inc";

// JWT resolver passed to <LingbotWorld2Provider jwtToken>.
//
// `@reactor-team/js-sdk` 3.x takes a `JwtSource` — a static string or a
// resolver. Pass the resolver so the SDK can mint a fresh JWT on every
// Reactor API hop — uploads, clip manifests, ICE refreshes, SDP
// renegotiation. With a static string those hops 401 the moment the
// token ages out.
//
// The token is memoized HERE, in module scope, until shortly before it
// expires — and the fetch itself is `no-store`, so the browser HTTP
// cache is out of the picture. This matters because the token is
// session-scoped: a session can only be operated by the exact token
// that created it, so every hop of a session must present the same JWT.
// Relying on the browser cache for that breaks the moment it misses
// (DevTools "Disable cache", cache eviction): the resolver then mints a
// fresh token with no bound sessions and every upload/clip call 403s.
//
// Known edge this does not cover: a session created just before the
// memoized token expires is orphaned at the re-mint (the fresh token
// isn't bound to it). Fixing that requires re-minting with
// `authorization_details.resources.sessions.bind` naming the live
// session.
const TOKEN_REFRESH_SKEW_MS = 60_000;
let cachedToken: { jwt: string; expiresAtMs: number } | null = null;
let inflightToken: Promise<string> | null = null;

async function fetchToken(): Promise<string> {
  if (
    cachedToken &&
    Date.now() < cachedToken.expiresAtMs - TOKEN_REFRESH_SKEW_MS
  ) {
    return cachedToken.jwt;
  }
  // Coalesce the parallel hops the SDK fires at connect time into one mint.
  if (inflightToken) return inflightToken;
  inflightToken = (async () => {
    try {
      const r = await fetch("/api/reactor/token", { cache: "no-store" });
      if (!r.ok) {
        const body = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Token fetch failed: ${r.status}`);
      }
      const { jwt, expires_at } = (await r.json()) as {
        jwt: string;
        expires_at: number;
      };
      cachedToken = { jwt, expiresAtMs: expires_at * 1000 };
      return jwt;
    } finally {
      inflightToken = null;
    }
  })();
  return inflightToken;
}

function StatusBar() {
  const { status, connect, disconnect, reset } = useLingbotWorld2();

  const dotColor =
    status === "ready"
      ? "#4ade80"
      : status === "connecting" || status === "waiting"
        ? "#facc15"
        : "rgba(255,255,255,0.3)";

  const statusLabel =
    status === "ready"
      ? "Connected"
      : status === "waiting"
        ? "Waiting for GPU..."
        : status === "connecting"
          ? "Connecting..."
          : "Disconnected";

  return (
    <div
      className="flex items-center justify-between px-4 py-2 shrink-0"
      style={{
        background: "rgba(255,255,255,0.04)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full transition-colors"
            style={{
              backgroundColor: dotColor,
              animation:
                status === "connecting" || status === "waiting"
                  ? "statusPulse 1.5s infinite"
                  : "none",
            }}
          />
          <span className="font-mono text-xs text-white/50">{statusLabel}</span>
        </div>
        {status === "disconnected" ? (
          <Button
            size="xs"
            variant="secondary"
            onClick={() => connect()}
            className="h-7 px-3 font-mono text-xs bg-white/10 border-white/15 hover:bg-white/15 text-white"
          >
            Connect
          </Button>
        ) : (
          <Button
            size="xs"
            variant="secondary"
            onClick={() => disconnect()}
            className="h-7 px-3 font-mono text-xs bg-white/10 border-white/15 hover:bg-white/15 text-white"
          >
            {status === "connecting" || status === "waiting"
              ? "Cancel"
              : "Disconnect"}
          </Button>
        )}
        {status === "ready" && (
          <Button
            size="xs"
            variant="secondary"
            onClick={() => reset()}
            className="h-7 px-3 font-mono text-xs bg-red-500/15 border-red-500/20 hover:bg-red-500/25 text-red-400"
          >
            Reset
          </Button>
        )}
      </div>
    </div>
  );
}

function MainContent() {
  const { sidebar, controls, activeExampleId } = LingbotWorldController({});
  const [scenesOpen, setScenesOpen] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(false);

  return (
    <main className="relative z-10 flex-1 min-h-0 overflow-hidden px-3 pb-3 pt-2 max-lg:overflow-y-auto sm:px-4">
      <div className="mx-auto flex h-full min-h-0 w-full max-w-[1800px] flex-col gap-3 lg:flex-row">
        {scenesOpen && (
          <aside className="order-2 max-h-[60vh] min-w-0 overflow-y-auto rounded-xl border border-white/[0.08] bg-zinc-950 p-3 lg:order-1 lg:max-h-none lg:w-[300px] lg:shrink-0" aria-label="Scene library">
            {sidebar}
            <div className="mt-4"><SnapClip /></div>
          </aside>
        )}

        <section className="order-1 flex min-h-[55vh] min-w-0 flex-1 flex-col gap-2 lg:order-2 lg:min-h-0" aria-label="Interactive world">
          <div className="flex shrink-0 items-center gap-2">
            <Button size="xs" variant="secondary" onClick={() => setScenesOpen((open) => !open)} aria-expanded={scenesOpen}>
              {scenesOpen ? "Hide scenes" : "Scenes"}
            </Button>
            <Button size="xs" variant="secondary" onClick={() => setControlsOpen((open) => !open)} aria-expanded={controlsOpen}>
              {controlsOpen ? "Hide controls" : "Controls & Gemini"}
            </Button>
            <span className="ml-auto text-[10px] text-white/40">WASD to move · arrows to look</span>
          </div>

          <div className="relative min-h-[260px] flex-1 overflow-hidden rounded-xl border border-white/[0.08] bg-black">
            <LingbotWorld2MainVideoView
              videoObjectFit="contain"
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
            />
            {activeExampleId === "dino-runner" && (
              <div className="pointer-events-none absolute bottom-3 left-3 rounded border border-white/15 bg-black/65 px-3 py-2 font-mono text-xs text-white/90 backdrop-blur-sm">
                Hold <strong>W</strong> to move · <strong>Space</strong> jump · hold <strong>C</strong> duck
              </div>
            )}
          </div>

          <div className={controlsOpen
            ? "max-h-[32vh] shrink-0 overflow-y-auto rounded-xl border border-white/[0.08] bg-white/[0.02] p-3"
            : "hidden"}>
            {controls}
          </div>
        </section>
      </div>
    </main>
  );
}

// The client tree. LingbotWorld2Provider owns the WebRTC connection
// lifecycle — it auto-disconnects on unmount and on `beforeunload`, so
// don't call connect()/disconnect() from a useEffect yourself.
//
// We deliberately do NOT pass `autoConnect: true` here. The user clicks
// "Connect" so they see the disconnected → connecting → waiting → ready
// state machine first-hand. Flip it on in your own product if you'd
// rather skip straight to "ready".
//
// `getJwt` is a module-level function on purpose — stable identity, no
// re-render churn. The provider also auto-stabilizes inline arrows via
// `useRef + useMemo`, so wrapping in `useCallback` is never needed.
export function LingbotWorld2App() {
  return (
    <>
      <style>{`
        @keyframes statusPulse {
          0%, 100% { opacity: 1; } 50% { opacity: 0.4; }
        }
      `}</style>

      <div className="relative h-screen flex flex-col overflow-hidden bg-zinc-950">
        <Header />
        <LingbotWorld2Provider apiUrl={API_URL} jwtToken={fetchToken}>
          <div className="relative z-10 shrink-0">
            <StatusBar />
          </div>
          <MainContent />
        </LingbotWorld2Provider>
      </div>
    </>
  );
}
