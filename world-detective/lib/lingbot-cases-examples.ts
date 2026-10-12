// Example scenarios sourced from the "lingbot-cases" corpus
// (case1/{0036,0038}, case2/{1012}, Manhattan Crime Scene, Javelin Throw,
// Dino Runner).
//
// The scene DATA lives one-file-per-example under ./lingbot-cases/<slug>.json
// (slug = the example's kebab-cased name) — this module is just the loader /
// manifest: it imports each JSON and exports the ordered list the rest of the
// app consumes (LINGBOT_CASES_EXAMPLE_LIST). To edit a scene, edit its JSON; to
// add one, drop a new <slug>.json into ./lingbot-cases/ and add it below.
//
// Each JSON conforms to StructuredExample (see lingbot-world-prompts.ts) and is
// authored in layered-composition form: base.default = POV/motion-agnostic
// world identity (subject + environment + style); camera.default.{static,
// dynamic} = scene-specific framing selected by movement state; movement.default.
// {static,dynamic} = idle vs. movement; each non-jump action slot
// (keys 1..9) is one append-mode event clause. composePrompt() concatenates
// the active selection at runtime. Source images live at
// public/lingbot-cases/<id>.jpg.

import type { StructuredExample } from "@/lib/lingbot-world-prompts";

import noirAlleyPatrol from "./lingbot-cases/noir-alley-patrol.json";
import battlefieldHorseman from "./lingbot-cases/battlefield-horseman.json";
import jetSkiCruise from "./lingbot-cases/jet-ski-cruise.json";
import manhattanCrimeScene from "./lingbot-cases/manhattan-crime-scene.json";
import javelinThrow from "./lingbot-cases/javelin-throw.json";
import dinoRunner from "./lingbot-cases/dino-runner.json";

// The display order of the example chips. Add new examples here.
export const LINGBOT_CASES_EXAMPLE_LIST: StructuredExample[] = [
  noirAlleyPatrol,
  battlefieldHorseman,
  jetSkiCruise,
  manhattanCrimeScene,
  javelinThrow,
  dinoRunner,
] as StructuredExample[];
