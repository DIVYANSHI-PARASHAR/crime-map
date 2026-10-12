export type CrimeDirectorCue = "quiet" | "sound" | "glimpse" | "reveal" | "restore";

// Only these authored cues can reach the world model. Gemini's free-form
// observation is displayed to the player but never appended to its prompt.
export const CRIME_DIRECTOR_PROMPTS: Record<CrimeDirectorCue, string> = {
  quiet: "",
  sound: "Director cue: A faint, ordinary floorboard creak comes from behind the bedroom door. The door and all evidence remain in place. No person is visible yet.",
  glimpse: "Director cue: As the player looks toward the bedroom, the one hidden living person is briefly visible deeper inside that room, partly obscured by the doorframe. The person never appears in front of the camera or beside the floor victim. No confrontation or weapon action occurs.",
  reveal: "Director cue: The one living person is now visible inside the bedroom, beyond its doorway, for the investigator to find. Keep the person's identity and position consistent in subsequent frames. The person does not approach, attack, or hold a weapon. The victim and all evidence remain where they were.",
  restore: "Director correction: Return to the established eye-level first-person apartment view. The viewer is invisible, with no visible hands or body. Only the original one handgun lies flat by marker 3; it is never held or fired. Restore the original furniture, evidence, doorway, lighting, and character positions. No cut or new person in the foreground.",
};
