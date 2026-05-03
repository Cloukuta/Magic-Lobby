import { customAlphabet } from "nanoid";

export type GameStatus = "waiting" | "active" | "ended";

export type ManaPool = {
  W: number;
  U: number;
  B: number;
  R: number;
  G: number;
  C: number;
};

export type Player = {
  id: string;
  name: string;
  life: number;
  isHost: boolean;
  isConnected: boolean;
  isEliminated: boolean;
  position: number;
  color: string;
  commanderTax: number;
  commanderName: string;
  manaPool: ManaPool;
};

export type CommanderDamageEntry = {
  fromPlayerId: string;
  toPlayerId: string;
  amount: number;
};

export type GameLogKind =
  | "lifeChanged"
  | "commanderDamage"
  | "turnAdvanced"
  | "playerJoined"
  | "playerLeft"
  | "playerEliminated"
  | "gameStarted"
  | "gameReset"
  | "roll"
  | "orderRandomized"
  | "commanderNameSet"
  | "commanderTaxUpdated";

export type GameLogEntry = {
  id: string;
  at: string;
  kind: GameLogKind;
  message: string;
  actorId?: string;
  targetId?: string;
  amount?: number;
};

export type Game = {
  id: string;
  code: string;
  status: GameStatus;
  startingLife: number;
  turnNumber: number;
  currentTurnPlayerId: string | null;
  hostId: string;
  players: Player[];
  commanderDamage: CommanderDamageEntry[];
  log: GameLogEntry[];
  createdAt: string;
  // server-only:
  tokens: Map<string, string>; // token -> playerId
};

const PLAYER_COLORS = [
  "#a855f7", // violet
  "#f59e0b", // amber
  "#10b981", // emerald
  "#ef4444", // red
  "#3b82f6", // blue
  "#ec4899", // pink
  "#14b8a6", // teal
  "#84cc16", // lime
];

const codeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I/O for legibility
const generateCode = customAlphabet(codeAlphabet, 4);
const generateId = customAlphabet(
  "abcdefghijklmnopqrstuvwxyz0123456789",
  16,
);
const generateToken = customAlphabet(
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
  32,
);

const games = new Map<string, Game>(); // code -> game
const gamesById = new Map<string, Game>(); // id -> game

const MAX_PLAYERS = 8;
const MAX_LOG = 200;

function nextColor(game: Game): string {
  const used = new Set(game.players.map((p) => p.color));
  for (const c of PLAYER_COLORS) {
    if (!used.has(c)) return c;
  }
  return PLAYER_COLORS[game.players.length % PLAYER_COLORS.length]!;
}

function nextPosition(game: Game): number {
  const used = new Set(game.players.map((p) => p.position));
  for (let i = 0; i < MAX_PLAYERS; i += 1) {
    if (!used.has(i)) return i;
  }
  return game.players.length;
}

function appendLog(game: Game, entry: Omit<GameLogEntry, "id" | "at">): void {
  game.log.unshift({
    id: generateId(),
    at: new Date().toISOString(),
    ...entry,
  });
  if (game.log.length > MAX_LOG) {
    game.log.length = MAX_LOG;
  }
}

function uniqueCode(): string {
  let attempts = 0;
  while (attempts < 50) {
    const c = generateCode();
    if (!games.has(c)) return c;
    attempts += 1;
  }
  throw new Error("Could not allocate unique game code");
}

export function createGame(input: {
  hostName: string;
  startingLife?: number;
}): { game: Game; player: Player; token: string } {
  const startingLife = input.startingLife ?? 40;
  const code = uniqueCode();
  const id = generateId();
  const hostPlayer: Player = {
    id: generateId(),
    name: input.hostName.trim().slice(0, 32) || "Host",
    life: startingLife,
    isHost: true,
    isConnected: false,
    isEliminated: false,
    position: 0,
    color: PLAYER_COLORS[0]!,
    commanderTax: 0,
    commanderName: "",
    manaPool: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
  };
  const token = generateToken();
  const game: Game = {
    id,
    code,
    status: "waiting",
    startingLife,
    turnNumber: 0,
    currentTurnPlayerId: null,
    hostId: hostPlayer.id,
    players: [hostPlayer],
    commanderDamage: [],
    log: [],
    createdAt: new Date().toISOString(),
    tokens: new Map([[token, hostPlayer.id]]),
  };
  appendLog(game, {
    kind: "playerJoined",
    message: `${hostPlayer.name} created the lobby`,
    actorId: hostPlayer.id,
  });
  games.set(code, game);
  gamesById.set(id, game);
  return { game, player: hostPlayer, token };
}

export function joinGame(
  code: string,
  input: { name: string },
): { game: Game; player: Player; token: string } | { error: string; status: number } {
  const game = games.get(code.toUpperCase());
  if (!game) return { error: "Game not found", status: 404 };
  if (game.status === "ended") return { error: "Game has ended", status: 409 };
  if (game.players.length >= MAX_PLAYERS)
    return { error: "Lobby is full", status: 409 };
  const name = input.name.trim().slice(0, 32) || "Player";
  const player: Player = {
    id: generateId(),
    name,
    life: game.startingLife,
    isHost: false,
    isConnected: false,
    isEliminated: false,
    position: nextPosition(game),
    color: nextColor(game),
    commanderTax: 0,
    commanderName: "",
    manaPool: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
  };
  game.players.push(player);
  appendLog(game, {
    kind: "playerJoined",
    message: `${player.name} joined`,
    actorId: player.id,
  });
  const token = generateToken();
  game.tokens.set(token, player.id);
  return { game, player, token };
}

export function getGameByCode(code: string): Game | undefined {
  return games.get(code.toUpperCase());
}

export function getGameById(id: string): Game | undefined {
  return gamesById.get(id);
}

export function resolveToken(
  token: string,
): { game: Game; player: Player } | undefined {
  for (const game of games.values()) {
    const playerId = game.tokens.get(token);
    if (playerId) {
      const player = game.players.find((p) => p.id === playerId);
      if (player) return { game, player };
    }
  }
  return undefined;
}

function checkElimination(game: Game, player: Player): boolean {
  if (player.isEliminated) return false;
  let eliminated = false;
  if (player.life <= 0) eliminated = true;
  if (!eliminated) {
    for (const entry of game.commanderDamage) {
      if (entry.toPlayerId === player.id && entry.amount >= 21) {
        eliminated = true;
        break;
      }
    }
  }
  if (eliminated) {
    player.isEliminated = true;
    appendLog(game, {
      kind: "playerEliminated",
      message: `${player.name} was eliminated`,
      targetId: player.id,
    });
    const alive = game.players.filter((p) => !p.isEliminated);
    if (alive.length <= 1) {
      game.status = "ended";
      const winner = alive[0];
      if (winner) {
        appendLog(game, {
          kind: "gameStarted",
          message: `${winner.name} wins the game`,
          actorId: winner.id,
        });
      }
    }
  }
  return eliminated;
}

export function updateLife(
  game: Game,
  actor: Player,
  targetId: string,
  delta: number,
): void {
  if (!Number.isFinite(delta)) return;
  const target = game.players.find((p) => p.id === targetId);
  if (!target) return;
  if (!actor.isHost && actor.id !== target.id) return;
  if (target.isEliminated) return;
  const clamped = Math.max(-50, Math.min(50, Math.trunc(delta)));
  target.life += clamped;
  appendLog(game, {
    kind: "lifeChanged",
    message: `${target.name} ${clamped >= 0 ? "+" : ""}${clamped} life (now ${target.life})`,
    actorId: actor.id,
    targetId: target.id,
    amount: clamped,
  });
  checkElimination(game, target);
}

export function setCommanderDamage(
  game: Game,
  actor: Player,
  fromPlayerId: string,
  toPlayerId: string,
  amount: number,
): void {
  if (!Number.isFinite(amount)) return;
  const from = game.players.find((p) => p.id === fromPlayerId);
  const to = game.players.find((p) => p.id === toPlayerId);
  if (!from || !to) return;
  if (from.id === to.id) return;
  // Permission: actor must be host, or actor is the recipient (logging damage taken),
  // or actor is the source (logging damage dealt).
  if (!actor.isHost && actor.id !== from.id && actor.id !== to.id) return;
  if (to.isEliminated) return;
  const next = Math.max(0, Math.min(99, Math.trunc(amount)));
  const existing = game.commanderDamage.find(
    (e) => e.fromPlayerId === from.id && e.toPlayerId === to.id,
  );
  const prev = existing?.amount ?? 0;
  const delta = next - prev;
  if (delta === 0) return;
  if (existing) {
    existing.amount = next;
  } else {
    game.commanderDamage.push({
      fromPlayerId: from.id,
      toPlayerId: to.id,
      amount: next,
    });
  }
  if (delta > 0) {
    // Commander damage also reduces life
    to.life -= delta;
    appendLog(game, {
      kind: "commanderDamage",
      message: `${from.name} dealt ${delta} commander damage to ${to.name} (${next} total)`,
      actorId: actor.id,
      targetId: to.id,
      amount: delta,
    });
  } else {
    appendLog(game, {
      kind: "commanderDamage",
      message: `Commander damage from ${from.name} on ${to.name} set to ${next}`,
      actorId: actor.id,
      targetId: to.id,
      amount: delta,
    });
  }
  checkElimination(game, to);
}

export function startGame(game: Game, actor: Player): void {
  if (!actor.isHost) return;
  if (game.status !== "waiting") return;
  game.status = "active";
  game.turnNumber = 1;
  const order = [...game.players].sort((a, b) => a.position - b.position);
  const first = order.find((p) => !p.isEliminated) ?? order[0];
  game.currentTurnPlayerId = first?.id ?? game.hostId;
  appendLog(game, {
    kind: "gameStarted",
    message: `Game started — ${first?.name ?? "Host"} goes first`,
    actorId: actor.id,
  });
}

export function randomizeOrder(game: Game, actor: Player): void {
  if (!actor.isHost) return;
  if (game.status !== "waiting") return;
  if (game.players.length < 2) return;
  // Fisher–Yates shuffle of positions
  const positions = game.players.map((_, i) => i);
  for (let i = positions.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = positions[i]!;
    positions[i] = positions[j]!;
    positions[j] = tmp;
  }
  game.players.forEach((p, i) => {
    p.position = positions[i]!;
  });
  const ordered = [...game.players].sort((a, b) => a.position - b.position);
  appendLog(game, {
    kind: "orderRandomized",
    message: `Turn order randomized: ${ordered.map((p) => p.name).join(" → ")}`,
    actorId: actor.id,
  });
}

export function nextTurn(game: Game, actor: Player): void {
  if (game.status !== "active") return;
  // Host can always advance; otherwise only the current turn player may pass their own turn.
  if (!actor.isHost && actor.id !== game.currentTurnPlayerId) return;
  // Clear outgoing player's mana pool
  const outgoing = game.players.find((p) => p.id === game.currentTurnPlayerId);
  if (outgoing) clearMana(outgoing);
  const order = [...game.players].sort((a, b) => a.position - b.position);
  const aliveOrder = order.filter((p) => !p.isEliminated);
  if (aliveOrder.length === 0) return;
  const currentIdx = aliveOrder.findIndex(
    (p) => p.id === game.currentTurnPlayerId,
  );
  const nextIdx = currentIdx === -1 ? 0 : (currentIdx + 1) % aliveOrder.length;
  const nextPlayer = aliveOrder[nextIdx]!;
  game.currentTurnPlayerId = nextPlayer.id;
  game.turnNumber += 1;
  appendLog(game, {
    kind: "turnAdvanced",
    message: `Turn ${game.turnNumber} — ${nextPlayer.name}`,
    actorId: actor.id,
    targetId: nextPlayer.id,
  });
}

export function setTurn(game: Game, actor: Player, playerId: string): void {
  if (!actor.isHost) return;
  if (game.status !== "active") return;
  const target = game.players.find((p) => p.id === playerId);
  if (!target || target.isEliminated) return;
  // Clear outgoing player's mana
  const outgoing = game.players.find((p) => p.id === game.currentTurnPlayerId);
  if (outgoing) clearMana(outgoing);
  game.currentTurnPlayerId = target.id;
  appendLog(game, {
    kind: "turnAdvanced",
    message: `Turn passed to ${target.name}`,
    actorId: actor.id,
    targetId: target.id,
  });
}

export function resetGame(game: Game, actor: Player): void {
  if (!actor.isHost) return;
  for (const p of game.players) {
    p.life = game.startingLife;
    p.isEliminated = false;
    p.commanderTax = 0;
    p.manaPool = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
  }
  game.commanderDamage = [];
  game.status = "waiting";
  game.turnNumber = 0;
  game.currentTurnPlayerId = null;
  game.log = [];
  appendLog(game, {
    kind: "gameReset",
    message: "Game reset to starting state",
    actorId: actor.id,
  });
}

export function kickPlayer(
  game: Game,
  actor: Player,
  playerId: string,
): { kickedTokens: string[] } {
  if (!actor.isHost) return { kickedTokens: [] };
  if (playerId === game.hostId) return { kickedTokens: [] };
  const target = game.players.find((p) => p.id === playerId);
  if (!target) return { kickedTokens: [] };
  game.players = game.players.filter((p) => p.id !== playerId);
  game.commanderDamage = game.commanderDamage.filter(
    (e) => e.fromPlayerId !== playerId && e.toPlayerId !== playerId,
  );
  if (game.currentTurnPlayerId === playerId) {
    const order = [...game.players].sort((a, b) => a.position - b.position);
    const alive = order.find((p) => !p.isEliminated);
    game.currentTurnPlayerId = alive?.id ?? null;
  }
  const kickedTokens: string[] = [];
  for (const [token, pid] of game.tokens.entries()) {
    if (pid === playerId) {
      kickedTokens.push(token);
      game.tokens.delete(token);
    }
  }
  appendLog(game, {
    kind: "playerLeft",
    message: `${target.name} was removed from the lobby`,
    actorId: actor.id,
    targetId: playerId,
  });
  return { kickedTokens };
}

export function setStartingLife(
  game: Game,
  actor: Player,
  value: number,
): void {
  if (!actor.isHost) return;
  if (game.status !== "waiting") return;
  if (!Number.isFinite(value)) return;
  const next = Math.max(1, Math.min(100, Math.trunc(value)));
  game.startingLife = next;
  for (const p of game.players) {
    p.life = next;
  }
}

export type RollKind = "coin" | "d6" | "d20";

export function rollDice(
  game: Game,
  actor: Player,
  kind: RollKind,
): void {
  let result: string;
  let amount: number;
  switch (kind) {
    case "coin": {
      const flip = Math.random() < 0.5 ? "Heads" : "Tails";
      result = `flipped a coin → ${flip}`;
      amount = flip === "Heads" ? 1 : 0;
      break;
    }
    case "d6": {
      amount = 1 + Math.floor(Math.random() * 6);
      result = `rolled D6 → ${amount}`;
      break;
    }
    case "d20": {
      amount = 1 + Math.floor(Math.random() * 20);
      result = `rolled D20 → ${amount}`;
      break;
    }
    default:
      return;
  }
  appendLog(game, {
    kind: "roll",
    message: `${actor.name} ${result}`,
    actorId: actor.id,
    amount,
  });
}

function clearMana(player: Player): void {
  player.manaPool = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
}

export type ManaColor = keyof ManaPool;

export function updateCommanderTax(
  game: Game,
  actor: Player,
  targetId: string,
  delta: number,
): void {
  const target = game.players.find((p) => p.id === targetId);
  if (!target) return;
  if (!actor.isHost && actor.id !== target.id) return;
  const next = Math.max(0, target.commanderTax + delta);
  target.commanderTax = next;
  appendLog(game, {
    kind: "commanderTaxUpdated",
    message: `${target.name}'s commander tax is now ${next}`,
    actorId: actor.id,
    targetId: target.id,
    amount: next,
  });
}

export function setCommanderName(
  game: Game,
  actor: Player,
  targetId: string,
  commanderName: string,
): void {
  const target = game.players.find((p) => p.id === targetId);
  if (!target) return;
  if (!actor.isHost && actor.id !== target.id) return;
  const trimmed = commanderName.trim().slice(0, 64);
  target.commanderName = trimmed;
  if (trimmed) {
    appendLog(game, {
      kind: "commanderNameSet",
      message: `${target.name}'s commander is ${trimmed}`,
      actorId: actor.id,
      targetId: target.id,
    });
  }
}

export function updateMana(
  game: Game,
  actor: Player,
  color: ManaColor,
  delta: number,
): void {
  if (game.status !== "active") return;
  if (actor.id !== game.currentTurnPlayerId && !actor.isHost) return;
  const target = game.players.find((p) => p.id === game.currentTurnPlayerId);
  if (!target) return;
  const COLORS: ManaColor[] = ["W", "U", "B", "R", "G", "C"];
  if (!COLORS.includes(color)) return;
  target.manaPool[color] = Math.max(0, target.manaPool[color] + delta);
}

export function setConnected(player: Player, connected: boolean): void {
  player.isConnected = connected;
}

export type PublicGame = Omit<Game, "tokens">;

export function toPublicGame(game: Game): PublicGame {
  // Strip tokens from outgoing snapshots
  const { tokens: _tokens, ...rest } = game;
  return rest;
}

export function computeStats(game: Game): {
  totalDamageDealt: { playerId: string; playerName: string; total: number }[];
  biggestSingleHit: {
    fromPlayerId: string;
    fromPlayerName: string;
    toPlayerId: string;
    toPlayerName: string;
    amount: number;
  } | null;
  eliminatedCount: number;
  turnsPlayed: number;
} {
  const totals = new Map<string, number>();
  for (const e of game.commanderDamage) {
    totals.set(e.fromPlayerId, (totals.get(e.fromPlayerId) ?? 0) + e.amount);
  }
  const totalDamageDealt = game.players.map((p) => ({
    playerId: p.id,
    playerName: p.name,
    total: totals.get(p.id) ?? 0,
  }));
  totalDamageDealt.sort((a, b) => b.total - a.total);
  let biggest: {
    fromPlayerId: string;
    fromPlayerName: string;
    toPlayerId: string;
    toPlayerName: string;
    amount: number;
  } | null = null;
  for (const e of game.commanderDamage) {
    if (!biggest || e.amount > biggest.amount) {
      const from = game.players.find((p) => p.id === e.fromPlayerId);
      const to = game.players.find((p) => p.id === e.toPlayerId);
      if (from && to) {
        biggest = {
          fromPlayerId: from.id,
          fromPlayerName: from.name,
          toPlayerId: to.id,
          toPlayerName: to.name,
          amount: e.amount,
        };
      }
    }
  }
  return {
    totalDamageDealt,
    biggestSingleHit: biggest,
    eliminatedCount: game.players.filter((p) => p.isEliminated).length,
    turnsPlayed: game.turnNumber,
  };
}
