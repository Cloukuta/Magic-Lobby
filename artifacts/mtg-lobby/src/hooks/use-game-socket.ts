import { useState, useEffect, useCallback, useRef } from "react";
import type { GameState } from "@workspace/api-client-react";

export interface Session {
  token: string;
  playerId: string;
  code: string;
  isHost: boolean;
}

const STORAGE_KEY = "mtg_lobby_sessions";

export function getSession(code: string): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const sessions = JSON.parse(raw) as Record<string, Session>;
    return sessions[code] || null;
  } catch {
    return null;
  }
}

export function saveSession(session: Session) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const sessions = raw ? JSON.parse(raw) : {};
    sessions[session.code] = session;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch {}
}

export function clearSession(code: string) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const sessions = JSON.parse(raw) as Record<string, Session>;
    delete sessions[code];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch {}
}

type ClientAction = 
  | { type: "updateLife"; playerId: string; delta: number }
  | { type: "commanderDamage"; fromPlayerId: string; toPlayerId: string; amount: number }
  | { type: "nextTurn" }
  | { type: "setTurn"; playerId: string }
  | { type: "startGame" }
  | { type: "resetGame" }
  | { type: "kickPlayer"; playerId: string }
  | { type: "setStartingLife"; value: number }
  | { type: "roll"; kind: "coin" | "d6" | "d20" };

export function useGameSocket(token: string | undefined, initialGame?: GameState) {
  const [game, setGame] = useState<GameState | undefined>(initialGame);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    if (!token) return;
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) return;

    const wsProto = location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${wsProto}//${location.host}/ws?token=${token}`);

    ws.onopen = () => {
      setConnected(true);
      setError(null);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "state" && msg.game) {
          setGame(msg.game);
        } else if (msg.type === "error") {
          setError(msg.message);
        }
      } catch (e) {
        console.error("Failed to parse websocket message", e);
      }
    };

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
      // Auto-reconnect with backoff
      setTimeout(() => connect(), 3000);
    };

    wsRef.current = ws;
  }, [token]);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  const sendAction = useCallback((action: ClientAction) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(action));
    } else {
      console.warn("Cannot send action, websocket not open", action);
    }
  }, []);

  return { game, sendAction, connected, error };
}
