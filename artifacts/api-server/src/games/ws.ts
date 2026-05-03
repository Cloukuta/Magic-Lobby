import type { Server as HttpServer, IncomingMessage } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { logger } from "../lib/logger";
import {
  resolveToken,
  toPublicGame,
  setConnected,
  updateLife,
  setCommanderDamage,
  startGame,
  nextTurn,
  setTurn,
  resetGame,
  kickPlayer,
  setStartingLife,
  rollDice,
  randomizeOrder,
  updateCommanderTax,
  setCommanderName,
  updateMana,
  type Game,
  type Player,
  type RollKind,
  type ManaColor,
} from "./store";

type GameSocket = WebSocket & {
  _gameId?: string;
  _playerId?: string;
  _isAlive?: boolean;
};

// gameId -> set of sockets
const sockets = new Map<string, Set<GameSocket>>();

function addSocket(gameId: string, ws: GameSocket): void {
  let set = sockets.get(gameId);
  if (!set) {
    set = new Set();
    sockets.set(gameId, set);
  }
  set.add(ws);
}

function removeSocket(gameId: string, ws: GameSocket): void {
  const set = sockets.get(gameId);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) sockets.delete(gameId);
}

function broadcast(game: Game): void {
  const payload = JSON.stringify({
    type: "state",
    game: toPublicGame(game),
  });
  const set = sockets.get(game.id);
  if (!set) return;
  for (const ws of set) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

function recomputeConnections(game: Game): void {
  const set = sockets.get(game.id);
  const connectedIds = new Set<string>();
  if (set) {
    for (const ws of set) {
      if (ws.readyState === WebSocket.OPEN && ws._playerId) {
        connectedIds.add(ws._playerId);
      }
    }
  }
  for (const p of game.players) {
    setConnected(p, connectedIds.has(p.id));
  }
}

function send(ws: WebSocket, msg: unknown): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function parseToken(req: IncomingMessage): string | undefined {
  if (!req.url) return undefined;
  try {
    const url = new URL(req.url, "http://localhost");
    return url.searchParams.get("token") ?? undefined;
  } catch {
    return undefined;
  }
}

type ClientMessage =
  | { type: "updateLife"; playerId: string; delta: number }
  | {
      type: "commanderDamage";
      fromPlayerId: string;
      toPlayerId: string;
      amount: number;
    }
  | { type: "nextTurn" }
  | { type: "setTurn"; playerId: string }
  | { type: "startGame" }
  | { type: "resetGame" }
  | { type: "kickPlayer"; playerId: string }
  | { type: "setStartingLife"; value: number }
  | { type: "roll"; kind: RollKind }
  | { type: "randomizeOrder" }
  | { type: "updateCommanderTax"; playerId: string; delta: number }
  | { type: "setCommanderName"; playerId: string; commanderName: string }
  | { type: "updateMana"; color: ManaColor; delta: number }
  | { type: "ping" };

function handleMessage(
  ws: GameSocket,
  game: Game,
  player: Player,
  raw: string,
): void {
  let msg: ClientMessage;
  try {
    msg = JSON.parse(raw) as ClientMessage;
  } catch {
    send(ws, { type: "error", message: "Invalid JSON" });
    return;
  }
  switch (msg.type) {
    case "updateLife":
      updateLife(game, player, msg.playerId, msg.delta);
      break;
    case "commanderDamage":
      setCommanderDamage(
        game,
        player,
        msg.fromPlayerId,
        msg.toPlayerId,
        msg.amount,
      );
      break;
    case "nextTurn":
      nextTurn(game, player);
      break;
    case "setTurn":
      setTurn(game, player, msg.playerId);
      break;
    case "startGame":
      startGame(game, player);
      break;
    case "resetGame":
      resetGame(game, player);
      break;
    case "kickPlayer": {
      const { kickedTokens } = kickPlayer(game, player, msg.playerId);
      // Disconnect any sockets belonging to the kicked player
      const set = sockets.get(game.id);
      if (set) {
        for (const s of set) {
          if (s._playerId === msg.playerId) {
            send(s, { type: "error", message: "Removed by host" });
            try {
              s.close();
            } catch {
              /* noop */
            }
          }
        }
      }
      // Tokens already invalidated in store
      void kickedTokens;
      break;
    }
    case "setStartingLife":
      setStartingLife(game, player, msg.value);
      break;
    case "roll":
      rollDice(game, player, msg.kind);
      break;
    case "randomizeOrder":
      randomizeOrder(game, player);
      break;
    case "updateCommanderTax":
      updateCommanderTax(game, player, msg.playerId, msg.delta);
      break;
    case "setCommanderName":
      setCommanderName(game, player, msg.playerId, msg.commanderName);
      break;
    case "updateMana":
      updateMana(game, player, msg.color, msg.delta);
      break;
    case "ping":
      send(ws, { type: "pong" });
      return; // no broadcast
    default:
      send(ws, { type: "error", message: "Unknown action" });
      return;
  }
  recomputeConnections(game);
  broadcast(game);
}

export function attachWebSocketServer(server: HttpServer): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    if (!req.url || !req.url.startsWith("/ws")) {
      return; // let other handlers process
    }
    const token = parseToken(req);
    if (!token) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }
    const resolved = resolveToken(token);
    if (!resolved) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      const gws = ws as GameSocket;
      gws._gameId = resolved.game.id;
      gws._playerId = resolved.player.id;
      gws._isAlive = true;
      wss.emit("connection", gws, req);
    });
  });

  wss.on("connection", (ws: GameSocket) => {
    const gameId = ws._gameId;
    const playerId = ws._playerId;
    if (!gameId || !playerId) {
      ws.close();
      return;
    }
    // Look up game/player from store fresh on every event
    addSocket(gameId, ws);

    // initial state push
    {
      const resolved = findGameAndPlayer(gameId, playerId);
      if (resolved) {
        recomputeConnections(resolved.game);
        broadcast(resolved.game);
      }
    }

    ws.on("pong", () => {
      ws._isAlive = true;
    });

    ws.on("message", (data) => {
      const resolved = findGameAndPlayer(gameId, playerId);
      if (!resolved) {
        send(ws, { type: "error", message: "Game no longer exists" });
        ws.close();
        return;
      }
      const text = typeof data === "string" ? data : data.toString();
      try {
        handleMessage(ws, resolved.game, resolved.player, text);
      } catch (err) {
        logger.error({ err }, "Error handling WS message");
        send(ws, { type: "error", message: "Server error" });
      }
    });

    ws.on("close", () => {
      removeSocket(gameId, ws);
      const resolved = findGameAndPlayer(gameId, playerId);
      if (resolved) {
        recomputeConnections(resolved.game);
        broadcast(resolved.game);
      }
    });

    ws.on("error", (err) => {
      logger.warn({ err }, "WS error");
    });
  });

  // Heartbeat to drop dead connections
  const interval = setInterval(() => {
    for (const set of sockets.values()) {
      for (const ws of set) {
        if (ws._isAlive === false) {
          try {
            ws.terminate();
          } catch {
            /* noop */
          }
          continue;
        }
        ws._isAlive = false;
        try {
          ws.ping();
        } catch {
          /* noop */
        }
      }
    }
  }, 30000);

  wss.on("close", () => clearInterval(interval));
}

function findGameAndPlayer(
  gameId: string,
  playerId: string,
): { game: Game; player: Player } | undefined {
  // Import here to avoid circular hoist; store keeps the canonical maps.
  // Using getGameById from store via dynamic reference.
  const game = getGameByIdInternal(gameId);
  if (!game) return undefined;
  const player = game.players.find((p) => p.id === playerId);
  if (!player) return undefined;
  return { game, player };
}

// Avoid circular import warnings by pulling lazily.
import { getGameById as getGameByIdInternal } from "./store";
