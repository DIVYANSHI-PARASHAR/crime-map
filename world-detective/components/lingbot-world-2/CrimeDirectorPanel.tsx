"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLingbotWorld2Track } from "@reactor-models/lingbot-world-2";
import { Button } from "@/components/ui/button";
import { CRIME_DIRECTOR_PROMPTS, type CrimeDirectorCue } from "@/lib/crime-director";

type Observation = {
  doorwayVisible: boolean;
  doorwayNear: boolean;
  insideBedroom: boolean;
  otherPersonVisible: boolean;
  visualDrift: boolean;
  summary: string;
};

type Activity = {
  id: number;
  time: string;
  kind: "frame" | "cue" | "error";
  message: string;
};

const INTERVAL_MS = 8000;
const CUE_LABELS: Record<CrimeDirectorCue, string> = {
  quiet: "No cue · observing",
  sound: "Bedroom sound",
  glimpse: "Person glimpsed",
  reveal: "Person revealed",
  restore: "Scene correction",
};

function Finding({ label, seen }: { label: string; seen: boolean }) {
  return (
    <span className={`rounded border px-2 py-1 font-mono text-[10px] ${seen
      ? "border-amber-300/40 bg-amber-300/10 text-amber-100"
      : "border-white/10 bg-white/[0.025] text-white/35"}`}>
      {seen ? "●" : "○"} {label}
    </span>
  );
}

export function CrimeDirectorPanel({
  running,
  onCue,
}: {
  running: boolean;
  onCue: (cue: CrimeDirectorCue) => void;
}) {
  const track = useLingbotWorld2Track("main_video");
  const [enabled, setEnabled] = useState(false);
  const [phase, setPhase] = useState("Off");
  const [error, setError] = useState<string | null>(null);
  const [observation, setObservation] = useState<Observation | null>(null);
  const [framePreview, setFramePreview] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const [nextSampleAt, setNextSampleAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activeCue, setActiveCue] = useState<CrimeDirectorCue>("quiet");
  const [found, setFound] = useState(false);
  const stage = useRef(0);
  const sampleCount = useRef(0);
  const activityId = useRef(0);
  const cueRef = useRef<CrimeDirectorCue>("quiet");
  const onCueRef = useRef(onCue);

  const addActivity = useCallback((kind: Activity["kind"], message: string) => {
    const entry: Activity = {
      id: ++activityId.current,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      kind,
      message,
    };
    setActivities((current) => [entry, ...current].slice(0, 8));
  }, []);

  useEffect(() => { onCueRef.current = onCue; }, [onCue]);

  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !running || !track) return;
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.srcObject = new MediaStream([track]);
    void video.play().catch(() => setPhase("Video frame unavailable"));
    let stopped = false;
    let busy = false;
    let controller: AbortController | null = null;

    const sample = async () => {
      if (stopped || busy) return;
      if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        setPhase("Waiting for video frame");
        return;
      }
      busy = true;
      controller = new AbortController();
      const frameNumber = ++sampleCount.current;
      setPhase(`Gemini analyzing frame ${frameNumber}…`);
      setError(null);
      try {
        const canvas = document.createElement("canvas");
        const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
        canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
        canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
        canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
        const image = canvas.toDataURL("image/jpeg", 0.65);
        setFramePreview(image);
        const response = await fetch("/api/gemini/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image }),
          signal: controller.signal,
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || `Analysis returned ${response.status}`);
        if (stopped) return;
        const next = result as Observation;
        setObservation(next);
        setLastChecked(new Date().toLocaleTimeString());
        setPhase("Watching the scene");
        setError(null);
        addActivity("frame", `Frame ${frameNumber}: ${next.summary}`);

        if (!next.visualDrift) {
          if (stage.current === 0 && (next.doorwayNear || next.insideBedroom)) stage.current = 1;
          else if (stage.current > 0) stage.current = Math.min(3, stage.current + 1);
        }
        const storyCue: CrimeDirectorCue = (["quiet", "sound", "glimpse", "reveal"] as const)[stage.current];
        const cue: CrimeDirectorCue = next.visualDrift ? "restore" : storyCue;
        if (cue !== cueRef.current) {
          cueRef.current = cue;
          setActiveCue(cue);
          onCueRef.current(cue);
          addActivity("cue", cue === "quiet" ? "Removed the correction cue" : `Requested prompt cue: ${CUE_LABELS[cue]}`);
        }
        if (stage.current >= 2 && next.otherPersonVisible && !next.visualDrift) {
          setFound(true);
        }
      } catch (error) {
        if (!stopped) {
          const message = error instanceof Error ? error.message : "Frame analysis failed";
          setPhase(message);
          setError(message);
          addActivity("error", message);
        }
      } finally {
        busy = false;
      }
    };

    setNow(Date.now());
    setNextSampleAt(Date.now() + INTERVAL_MS);
    void sample();
    const timer = window.setInterval(() => {
      setNow(Date.now());
      setNextSampleAt(Date.now() + INTERVAL_MS);
      void sample();
    }, INTERVAL_MS);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      controller?.abort();
      video.pause();
      video.srcObject = null;
      setNextSampleAt(null);
    };
  }, [enabled, running, track, addActivity]);

  const toggle = () => {
    if (enabled) {
      setEnabled(false);
      stage.current = 0;
      cueRef.current = "quiet";
      setActiveCue("quiet");
      onCue("quiet");
      setPhase("Off");
      setError(null);
      addActivity("cue", "Director stopped; prompt cue removed");
    } else {
      setEnabled(true);
      setFound(false);
      setObservation(null);
      setFramePreview(null);
      setLastChecked(null);
      setActivities([]);
      sampleCount.current = 0;
      setPhase(running ? "Waiting for first frame" : "Waiting for scene to run");
      setError(null);
    }
  };

  const displayPhase = !enabled
    ? "Off"
    : !running
      ? "Waiting for scene to run or resume"
      : !track
        ? "Waiting for video stream"
        : phase;
  const secondsUntilNext = nextSampleAt === null ? null : Math.max(0, Math.ceil((nextSampleAt - now) / 1000));

  return (
    <section className="rounded-lg border border-amber-300/25 bg-amber-300/5 p-3 text-xs text-white/75" aria-label="Gemini crime director">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <strong className="text-amber-100">Gemini crime director</strong>
          <p className="mt-1 text-white/50">Sends a sampled video frame to Gemini, then guides the story with fixed prompt cues.</p>
        </div>
        <Button size="sm" variant="secondary" onClick={toggle}>{enabled ? "Stop director" : "Start director"}</Button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded border border-white/10 bg-black/20 px-2.5 py-2 font-mono text-[10px]">
        <span className={enabled && running && track ? "text-emerald-300" : "text-white/45"}>{enabled && running && track ? "● ACTIVE" : "○ INACTIVE"}</span>
        <span role="status" className={error && enabled && running ? "text-rose-300" : "text-white/75"}>{displayPhase}</span>
        {enabled && running && secondsUntilNext !== null && <span className="text-white/40">Next check in {secondsUntilNext}s</span>}
      </div>

      {framePreview && (
        <div className="mt-3 grid gap-3 sm:grid-cols-[160px_1fr]">
          <div>
            <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-white/45">Frame sent to Gemini</div>
            <div className="aspect-video rounded border border-white/15 bg-black bg-contain bg-center bg-no-repeat" style={{ backgroundImage: `url("${framePreview}")` }} role="img" aria-label="Last sampled video frame" />
          </div>
          <div className="min-w-0">
            <div className="font-mono text-[10px] uppercase tracking-wider text-white/45">Gemini observed</div>
            <p className="mt-1 leading-snug text-white/85">{observation?.summary ?? "Waiting for analysis…"}</p>
            {lastChecked && <p className="mt-1 font-mono text-[10px] text-white/35">Analyzed at {lastChecked}</p>}
          </div>
        </div>
      )}

      {observation && (
        <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Gemini visual findings">
          <Finding label="Bedroom door" seen={observation.doorwayVisible} />
          <Finding label="Near door" seen={observation.doorwayNear} />
          <Finding label="Inside bedroom" seen={observation.insideBedroom} />
          <Finding label="Another person" seen={observation.otherPersonVisible} />
          <Finding label="Scene drift" seen={observation.visualDrift} />
        </div>
      )}

      <div className="mt-3 rounded border border-white/10 bg-black/20 p-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-white/45">Requested LingBot cue</span>
          <span className={activeCue === "restore" ? "text-rose-300" : activeCue === "quiet" ? "text-white/50" : "text-amber-200"}>{CUE_LABELS[activeCue]}</span>
        </div>
        {activeCue !== "quiet" && (
          <details className="mt-2 text-white/55">
            <summary className="cursor-pointer select-none">Show exact prompt cue</summary>
            <p className="mt-2 leading-relaxed">{CRIME_DIRECTOR_PROMPTS[activeCue]}</p>
          </details>
        )}
      </div>

      {found && <p className="mt-3 font-semibold text-emerald-300">Person found in the bedroom.</p>}

      {activities.length > 0 && (
        <div className="mt-3">
          <div className="font-mono text-[10px] uppercase tracking-wider text-white/45">Recent activity</div>
          <ol className="mt-1 max-h-32 space-y-1 overflow-y-auto pr-1">
            {activities.map((entry) => (
              <li key={entry.id} className={`border-l-2 pl-2 leading-snug ${entry.kind === "error" ? "border-rose-400 text-rose-200" : entry.kind === "cue" ? "border-amber-300 text-amber-100/85" : "border-white/20 text-white/55"}`}>
                <span className="mr-2 font-mono text-[10px] text-white/35">{entry.time}</span>{entry.message}
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
