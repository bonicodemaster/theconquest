import { customAlphabet } from "nanoid";

// 6-char rooms, no ambiguous chars (no 0/O/1/I)
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const make = customAlphabet(ALPHABET, 6);

export const newGameCode = (): string => make();
export const newPlayerId = customAlphabet(
  "abcdefghijklmnopqrstuvwxyz0123456789",
  12
);
export const newId = customAlphabet(
  "abcdefghijklmnopqrstuvwxyz0123456789",
  16
);

// "Pavillon" player palette — coral, ocean, forest, mustard, plum, teal, then
// muted editorial variants for larger rooms. All read cleanly on cream paper.
export const PLAYER_COLORS = [
  "#d4541c", "#2a5f8d", "#3d6b3a", "#b88a2a", "#6b3a5f", "#2a7a7a",
  "#a23b2e", "#3f5e8c", "#7a6a2a", "#5a4a7a", "#2f6b55", "#8a5a2a",
];

export const HOST_COLOR = PLAYER_COLORS[0];
