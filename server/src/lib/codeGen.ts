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

export const PLAYER_COLORS = [
  "#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#a855f7",
  "#14b8a6", "#eab308",
];

export const HOST_COLOR = PLAYER_COLORS[0];
