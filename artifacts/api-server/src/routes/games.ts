import { Router, type IRouter } from "express";
import {
  CreateGameBody,
  JoinGameBody,
  JoinGameParams,
  GetGameParams,
  GetGameStatsParams,
} from "@workspace/api-zod";
import {
  createGame,
  joinGame,
  getGameByCode,
  toPublicGame,
  computeStats,
} from "../games/store";

const router: IRouter = Router();

router.post("/games", (req, res) => {
  const parsed = CreateGameBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const { game, player, token } = createGame(parsed.data);
  res.json({
    token,
    playerId: player.id,
    game: toPublicGame(game),
  });
});

router.post("/games/:code/join", (req, res) => {
  const params = JoinGameParams.safeParse(req.params);
  const body = JoinGameBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  const result = joinGame(params.data.code, body.data);
  if ("error" in result) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  res.json({
    token: result.token,
    playerId: result.player.id,
    game: toPublicGame(result.game),
  });
});

router.get("/games/:code", (req, res) => {
  const params = GetGameParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid code" });
    return;
  }
  const game = getGameByCode(params.data.code);
  if (!game) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(toPublicGame(game));
});

router.get("/games/:code/stats", (req, res) => {
  const params = GetGameStatsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid code" });
    return;
  }
  const game = getGameByCode(params.data.code);
  if (!game) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(computeStats(game));
});

export default router;
