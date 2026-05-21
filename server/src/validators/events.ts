import { z } from "zod";

export const usernameSchema = z
  .string()
  .trim()
  .min(2)
  .max(20)
  .regex(/^[\p{L}\p{N}_\-. ]+$/u, "Invalid characters in username");

export const settingsSchema = z.object({
  mode: z.enum(["conquest", "mystery"]),
  durationSec: z.number().int().positive().max(60 * 30),
  difficulty: z.enum(["easy", "normal"]),
  maxPlayers: z.number().int().min(2).max(30),
  isPrivate: z.boolean(),
  totalCountries: z.union([z.literal(20), z.literal(50), z.literal(100), z.literal(196)]).optional(),
});

export const createGameSchema = z.object({
  username: usernameSchema,
  settings: settingsSchema,
});

export const joinGameSchema = z.object({
  code: z.string().regex(/^[A-Z0-9]{6}$/),
  username: usernameSchema,
});

export const guessSchema = z.object({
  guess: z.string().trim().min(1).max(60),
});

export const chatSchema = z.object({
  text: z.string().trim().min(1).max(280),
});
