import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Skull, Shield, LogOut, FastForward, Crown, Pencil, Check, X, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Player, CommanderDamageEntry } from "@workspace/api-client-react";
import { useCommanderImage } from "../hooks/use-commander-image";

type ManaColor = "W" | "U" | "B" | "R" | "G" | "C";

const MANA_COLORS: { key: ManaColor; label: string; bg: string; text: string }[] = [
  { key: "W", label: "W", bg: "bg-yellow-100",   text: "text-yellow-900" },
  { key: "U", label: "U", bg: "bg-blue-500",     text: "text-white" },
  { key: "B", label: "B", bg: "bg-zinc-800",     text: "text-white" },
  { key: "R", label: "R", bg: "bg-red-500",      text: "text-white" },
  { key: "G", label: "G", bg: "bg-green-600",    text: "text-white" },
  { key: "C", label: "C", bg: "bg-zinc-400",     text: "text-zinc-900" },
];

interface Props {
  player: Player;
  isMe: boolean;
  isTurn: boolean;
  isHost: boolean;
  gameStatus: string;
  players: Player[];
  commanderDamage: CommanderDamageEntry[];
  myPlayerId: string;
  onUpdateLife: (playerId: string, delta: number) => void;
  onNextTurn: () => void;
  onKick: (playerId: string) => void;
  onExpand: (id: string) => void;
  onOpenDamageDialog: (player: Player) => void;
  onSetDamageFromBadge: (player: Player, dealerId: string, amount: number) => void;
  onSetCommanderName: (playerId: string, name: string) => void;
  onUpdateCommanderTax: (playerId: string, delta: number) => void;
  onUpdateMana: (color: ManaColor, delta: number) => void;
  onUpdatePoison: (playerId: string, delta: number) => void;
  onUpdateExperience: (playerId: string, delta: number) => void;
  onRevive: (playerId: string) => void;
  onPointerDown?: () => void;
}

function AnimatedLife({ life }: { life: number }) {
  const [prevLife, setPrevLife] = useState(life);
  const [delta, setDelta] = useState(0);

  useEffect(() => {
    if (life !== prevLife) {
      setDelta(life - prevLife);
      setPrevLife(life);
      const timer = setTimeout(() => setDelta(0), 1000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [life, prevLife]);

  return (
    <div className="relative w-32 flex justify-center items-center h-24">
      <AnimatePresence mode="popLayout">
        <motion.div
          key={life}
          initial={{ opacity: 0, y: delta > 0 ? 20 : -20, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: delta > 0 ? -20 : 20, scale: 0.8 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="absolute text-8xl font-serif font-black tabular-nums tracking-tighter"
          style={{ textShadow: "-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, 0 3px 6px rgba(0,0,0,0.8)" }}
        >
          {life}
        </motion.div>
      </AnimatePresence>
      <AnimatePresence>
        {delta !== 0 && (
          <motion.div
            initial={{ opacity: 1, y: 0, x: 40 }}
            animate={{ opacity: 0, y: delta > 0 ? -40 : 40, x: 40 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
            className={`absolute text-2xl font-bold ${delta > 0 ? "text-green-500" : "text-destructive"}`}
          >
            {delta > 0 ? "+" : ""}
            {delta}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ExpandedPlayerCard({
  player,
  isMe,
  isTurn,
  isHost,
  gameStatus,
  players,
  commanderDamage,
  myPlayerId,
  onUpdateLife,
  onNextTurn,
  onKick,
  onExpand,
  onOpenDamageDialog,
  onSetDamageFromBadge,
  onSetCommanderName,
  onUpdateCommanderTax,
  onUpdateMana,
  onUpdatePoison,
  onUpdateExperience,
  onRevive,
  onPointerDown,
}: Props) {
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(player.commanderName);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const artUrl = useCommanderImage(player.commanderName);

  const canEditCommander = isMe || isHost;
  const canEditTax = isMe || isHost;
  const canEditLife = isMe || isHost;

  useEffect(() => {
    if (editingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [editingName]);

  const submitCommanderName = () => {
    onSetCommanderName(player.id, nameDraft);
    setEditingName(false);
  };

  const manaTotal = Object.values(player.manaPool).reduce((a, b) => a + b, 0);
  const showMana = gameStatus === "active" && isTurn;
  const canEditMana = isMe || isHost;

  return (
    <motion.div
      layout
      onPointerDown={!isMe ? onPointerDown : undefined}
      className={`relative flex flex-col rounded-xl overflow-hidden border-2 transition-colors duration-500 bg-card ${
        isTurn
          ? "border-primary shadow-[0_0_30px_rgba(var(--primary),0.3)] z-10"
          : "border-card-border"
      }`}
      style={{ "--player-color": player.color } as React.CSSProperties}
      animate={isTurn ? { scale: 1.01 } : { scale: 1 }}
    >
      {/* Scryfall art background */}
      <AnimatePresence>
        {artUrl && (
          <motion.div
            key={artUrl}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="absolute inset-0 pointer-events-none z-0 overflow-hidden"
          >
            <img
              src={artUrl}
              alt=""
              className="w-full h-full object-contain opacity-[0.32]"
              style={{ objectPosition: "center center" }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Color bar */}
      <div className="h-3 w-full shrink-0 relative z-10" style={{ backgroundColor: player.color }} />

      <div className="p-5 flex-1 flex flex-col items-center relative z-10">
        {/* Eliminated overlay */}
        <AnimatePresence>
          {player.isEliminated && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 bg-background/85 backdrop-blur-[2px] z-20 flex flex-col items-center justify-center gap-4"
            >
              <Skull className="w-20 h-20 text-destructive drop-shadow-md" />
              <span className="text-3xl font-black text-destructive uppercase tracking-[0.3em] drop-shadow-sm">
                Eliminated
              </span>
              {isHost && (
                <button
                  type="button"
                  onClick={() => onRevive(player.id)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600/90 hover:bg-green-500 text-white text-sm font-bold transition-colors shadow-lg"
                >
                  <Heart className="w-4 h-4" />
                  Revive player
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header row: name + badges + connection */}
        <div className="flex items-center justify-between w-full mb-3">
          <div className="flex items-center gap-2 min-w-0">
            {!isMe ? (
              <button
                type="button"
                onClick={() => onExpand(player.id)}
                className="font-bold text-2xl tracking-tight hover:opacity-80 transition-opacity truncate"
                style={{ color: isTurn ? player.color : "inherit" }}
                title="Tap to collapse"
              >
                {player.name}
              </button>
            ) : (
              <span
                className="font-bold text-2xl tracking-tight truncate"
                style={{ color: isTurn ? player.color : "inherit" }}
              >
                {player.name}
              </span>
            )}
            {isMe && (
              <span className="text-xs font-bold uppercase px-2 py-0.5 bg-primary/20 text-primary rounded border border-primary/30">
                You
              </span>
            )}
            {player.isHost && (
              <span className="text-xs uppercase px-2 py-0.5 bg-secondary text-muted-foreground rounded border border-border">
                Host
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {isHost && !isMe && !player.isEliminated && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                onClick={() => onKick(player.id)}
              >
                <LogOut className="w-3 h-3" />
              </Button>
            )}
            <div
              className={`w-3 h-3 rounded-full shadow-sm ${
                player.isConnected ? "bg-green-500 shadow-green-500/50" : "bg-destructive shadow-destructive/50"
              }`}
              title={player.isConnected ? "Connected" : "Disconnected"}
            />
          </div>
        </div>

        {/* Commander name + tax row */}
        <div className="w-full flex items-center gap-2 mb-4 px-1">
          <Crown className="w-3.5 h-3.5 text-primary/70 shrink-0" />
          <div className="flex-1 min-w-0">
            {editingName ? (
              <div className="flex items-center gap-1">
                <input
                  ref={nameInputRef}
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitCommanderName();
                    if (e.key === "Escape") {
                      setNameDraft(player.commanderName);
                      setEditingName(false);
                    }
                  }}
                  placeholder="Commander name…"
                  className="flex-1 text-sm bg-secondary border border-primary/40 rounded px-2 py-0.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                  maxLength={64}
                />
                <button
                  type="button"
                  onClick={submitCommanderName}
                  className="p-1 rounded hover:bg-primary/20 text-primary"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => { setNameDraft(player.commanderName); setEditingName(false); }}
                  className="p-1 rounded hover:bg-destructive/20 text-muted-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1 min-w-0">
                <span className={`text-sm truncate ${player.commanderName ? "text-foreground font-medium" : "text-muted-foreground/60 italic"}`}>
                  {player.commanderName || "No commander set"}
                </span>
                {canEditCommander && (
                  <button
                    type="button"
                    onClick={() => { setNameDraft(player.commanderName); setEditingName(true); }}
                    className="shrink-0 p-0.5 rounded hover:bg-secondary text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}
          </div>
          {/* Commander Tax */}
          <div className="flex items-center gap-1 shrink-0 border-l border-border pl-2 ml-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Tax</span>
            {canEditTax && (
              <button
                type="button"
                onClick={() => onUpdateCommanderTax(player.id, -2)}
                className="w-5 h-5 rounded bg-secondary hover:bg-secondary/70 text-muted-foreground text-xs font-bold flex items-center justify-center transition-colors disabled:opacity-30"
                disabled={player.commanderTax === 0}
              >
                -
              </button>
            )}
            <span className="text-sm font-bold font-mono tabular-nums w-6 text-center text-primary">
              +{player.commanderTax}
            </span>
            {canEditTax && (
              <button
                type="button"
                onClick={() => onUpdateCommanderTax(player.id, 2)}
                className="w-5 h-5 rounded bg-secondary hover:bg-secondary/70 text-muted-foreground text-xs font-bold flex items-center justify-center transition-colors"
              >
                +
              </button>
            )}
          </div>
        </div>

        {/* Counters row: Poison + Experience */}
        {gameStatus === "active" && (
          <div className="w-full flex items-center justify-center gap-3 mb-4 px-1">
            {/* Poison counters */}
            <div className="flex items-center gap-1 border border-border rounded-lg px-2 py-1 bg-secondary/50">
              <span className="text-[10px] uppercase tracking-wider text-green-400 font-semibold">☠ Poison</span>
              {(isMe || isHost) && (
                <button
                  type="button"
                  onClick={() => onUpdatePoison(player.id, -1)}
                  disabled={player.poisonCounters === 0}
                  className="w-5 h-5 rounded bg-secondary hover:bg-secondary/70 text-muted-foreground text-xs font-bold flex items-center justify-center transition-colors disabled:opacity-30"
                >
                  -
                </button>
              )}
              <span className={`text-sm font-bold font-mono tabular-nums w-5 text-center ${player.poisonCounters >= 8 ? "text-destructive" : player.poisonCounters >= 5 ? "text-yellow-400" : "text-foreground"}`}>
                {player.poisonCounters}
              </span>
              {(isMe || isHost) && (
                <button
                  type="button"
                  onClick={() => onUpdatePoison(player.id, 1)}
                  className="w-5 h-5 rounded bg-secondary hover:bg-secondary/70 text-muted-foreground text-xs font-bold flex items-center justify-center transition-colors"
                >
                  +
                </button>
              )}
            </div>

            {/* Experience counters */}
            <div className="flex items-center gap-1 border border-border rounded-lg px-2 py-1 bg-secondary/50">
              <span className="text-[10px] uppercase tracking-wider text-purple-400 font-semibold">✦ Exp</span>
              {(isMe || isHost) && (
                <button
                  type="button"
                  onClick={() => onUpdateExperience(player.id, -1)}
                  disabled={player.experienceCounters === 0}
                  className="w-5 h-5 rounded bg-secondary hover:bg-secondary/70 text-muted-foreground text-xs font-bold flex items-center justify-center transition-colors disabled:opacity-30"
                >
                  -
                </button>
              )}
              <span className="text-sm font-bold font-mono tabular-nums w-6 text-center text-purple-300">
                {player.experienceCounters}
              </span>
              {(isMe || isHost) && (
                <button
                  type="button"
                  onClick={() => onUpdateExperience(player.id, 1)}
                  className="w-5 h-5 rounded bg-secondary hover:bg-secondary/70 text-muted-foreground text-xs font-bold flex items-center justify-center transition-colors"
                >
                  +
                </button>
              )}
            </div>
          </div>
        )}

        {/* Life controls */}
        <div className="flex-1 flex flex-col items-center justify-center w-full">
          {isMe && isTurn && gameStatus === "active" && (
            <Button
              variant="outline"
              size="sm"
              className="mb-4 border-primary/50 text-primary hover:bg-primary hover:text-primary-foreground"
              onClick={onNextTurn}
            >
              <FastForward className="w-4 h-4 mr-2" /> Pass My Turn
            </Button>
          )}

          <div className="flex items-center justify-between w-full max-w-[320px]">
            <div className="flex flex-col gap-4">
              <Button variant="outline" size="icon" className="w-16 h-16 rounded-2xl bg-secondary border-secondary-foreground/10 text-2xl font-bold hover:bg-secondary/80 active:scale-95 transition-transform disabled:opacity-20 disabled:cursor-not-allowed" disabled={!canEditLife} onClick={() => onUpdateLife(player.id, -5)}>-5</Button>
              <Button variant="outline" size="icon" className="w-16 h-16 rounded-2xl bg-secondary border-secondary-foreground/10 text-2xl font-bold hover:bg-secondary/80 active:scale-95 transition-transform disabled:opacity-20 disabled:cursor-not-allowed" disabled={!canEditLife} onClick={() => onUpdateLife(player.id, -1)}>-1</Button>
            </div>
            <AnimatedLife life={player.life} />
            <div className="flex flex-col gap-4">
              <Button variant="outline" size="icon" className="w-16 h-16 rounded-2xl bg-secondary border-secondary-foreground/10 text-2xl font-bold hover:bg-secondary/80 active:scale-95 transition-transform disabled:opacity-20 disabled:cursor-not-allowed" disabled={!canEditLife} onClick={() => onUpdateLife(player.id, 5)}>+5</Button>
              <Button variant="outline" size="icon" className="w-16 h-16 rounded-2xl bg-secondary border-secondary-foreground/10 text-2xl font-bold hover:bg-secondary/80 active:scale-95 transition-transform disabled:opacity-20 disabled:cursor-not-allowed" disabled={!canEditLife} onClick={() => onUpdateLife(player.id, 1)}>+1</Button>
            </div>
          </div>

          {!isMe && (
            <Button variant="ghost" className="mt-5 text-muted-foreground hover:text-foreground" onClick={() => onOpenDamageDialog(player)}>
              <Shield className="w-4 h-4 mr-2" /> Deal Cmdr Damage
            </Button>
          )}

          {/* Mana Floating Pool */}
          <AnimatePresence>
            {showMana && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-5 w-full overflow-hidden"
              >
                <div className="border border-primary/30 rounded-xl bg-background/60 p-3">
                  <div className="text-[10px] uppercase tracking-widest text-primary font-semibold mb-2 text-center flex items-center justify-center gap-2">
                    <span>Floating Mana</span>
                    {manaTotal > 0 && (
                      <span className="bg-primary/20 text-primary px-1.5 py-0.5 rounded text-[10px] font-bold">
                        {manaTotal} total
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-6 gap-1 text-center">
                    {MANA_COLORS.map(({ key, label, bg, text }) => (
                      <div key={key} className="flex flex-col items-center gap-1">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black ${bg} ${text}`}>
                          {label}
                        </span>
                        {canEditMana ? (
                          <>
                            <button
                              type="button"
                              onClick={() => onUpdateMana(key, 1)}
                              className="w-6 h-5 rounded bg-secondary hover:bg-secondary/70 text-xs font-bold text-muted-foreground"
                            >+</button>
                            <span className="text-sm font-bold tabular-nums font-mono text-foreground">
                              {player.manaPool[key]}
                            </span>
                            <button
                              type="button"
                              onClick={() => onUpdateMana(key, -1)}
                              disabled={player.manaPool[key] === 0}
                              className="w-6 h-5 rounded bg-secondary hover:bg-secondary/70 text-xs font-bold text-muted-foreground disabled:opacity-30"
                            >-</button>
                          </>
                        ) : (
                          <span className="text-sm font-bold tabular-nums font-mono text-foreground py-1">
                            {player.manaPool[key]}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Commander Damage Received badges */}
          {players.length > 1 && (
            <div className="mt-5 w-full">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 text-center font-semibold">
                Cmdr Damage Received
              </div>
              <div className="flex flex-wrap justify-center gap-1.5">
                {players
                  .filter((opp) => opp.id !== player.id)
                  .map((opp) => {
                    const dmg =
                      commanderDamage.find(
                        (cd) => cd.toPlayerId === player.id && cd.fromPlayerId === opp.id,
                      )?.amount || 0;
                    const lethal = dmg >= 21;
                    return (
                      <button
                        key={opp.id}
                        type="button"
                        onClick={() => onSetDamageFromBadge(player, opp.id, dmg)}
                        className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs font-mono tabular-nums transition-colors ${
                          lethal
                            ? "bg-destructive/20 border-destructive text-destructive font-bold"
                            : dmg > 0
                              ? "bg-secondary border-border hover:border-foreground/40"
                              : "bg-secondary/40 border-border/40 text-muted-foreground hover:border-foreground/30"
                        }`}
                        title={`Damage from ${opp.name}`}
                      >
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: opp.color }} />
                        <span>{dmg}/21</span>
                      </button>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
