import { bad, loadGameByCode, ok } from "../../_lib";
import { leaderboardFrom, publicState } from "@/lib/gameLogic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: { code: string } }) {
  const got = await loadGameByCode(ctx.params.code);
  if (!got) return bad("Partie introuvable", 404);
  return ok({
    state: publicState(got.game, got.players, got.conquests),
    leaderboard: leaderboardFrom(got.players, got.conquests, got.game.mode),
    // Server clock at response time. The client derives (server − client) offset
    // from this so the countdown uses server time, not the device clock.
    serverNow: Date.now(),
  });
}
