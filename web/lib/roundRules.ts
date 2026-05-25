/**
 * Wrong guesses allowed per player, per round, in the round-based modes
 * (Pays Mystère + Capitales). Shared by the client HUD (which locks the input
 * once a player is out of tries) and the server (which ends the round early
 * once every present player has used them all). Keep both in lockstep — that's
 * the whole point of this module.
 */
export const MAX_WRONG_GUESSES = 2;
