import { bad, dynamic, loadGameByCode, ok, runtime } from "../../_lib";
import { leaderboardFrom, publicState } from "@/lib/gameLogic";

export { runtime, dynamic };

export async function GET(_req: Request, ctx: { params: { code: string } }) {
  const got = await loadGameByCode(ctx.params.code);
  if (!got) return bad("Game not found", 404);
  return ok({
    state: publicState(got.game, got.players, got.conquests),
    leaderboard: leaderboardFrom(got.players, got.conquests, got.game.mode),
  });
}
