import { useEffect, useState, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { useGetGame, useGetGameStats } from "@workspace/api-client-react";
import { getGetGameQueryKey, getGetGameStatsQueryKey } from "@workspace/api-client-react";
import { useGameSocket, getSession, clearSession } from "../hooks/use-game-socket";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Copy, Skull, Shield, Swords, WifiOff, LogOut, FastForward, Play, RefreshCcw, ScrollText, Users, Activity, BarChart2, Dices, Coins, Shuffle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Player, GameState, GameLogEntry, CommanderDamageEntry } from "@workspace/api-client-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

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
            className={`absolute text-2xl font-bold ${delta > 0 ? 'text-green-500' : 'text-destructive'}`}
          >
            {delta > 0 ? '+' : ''}{delta}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Lobby() {
  const [match, params] = useRoute("/lobby/:code");
  const [, setLocation] = useLocation();
  const code = params?.code || "";

  const session = getSession(code);
  
  const { data: initialGame, isLoading: isLoadingInitial } = useGetGame(code, {
    query: { enabled: !!code && !session?.token, queryKey: getGetGameQueryKey(code), refetchInterval: false }
  });

  const { data: initialStats } = useGetGameStats(code, {
    query: { enabled: !!code, queryKey: getGetGameStatsQueryKey(code), refetchInterval: 10000 }
  });

  const { game, sendAction, connected } = useGameSocket(session?.token, initialGame);

  const [selectedPlayerForDamage, setSelectedPlayerForDamage] = useState<Player | null>(null);
  const [damageAmount, setDamageAmount] = useState<number>(0);
  const [damageDealerId, setDamageDealerId] = useState<string>("");
  const [lastRoll, setLastRoll] = useState<{ id: string; message: string } | null>(null);

  useEffect(() => {
    if (!session && !isLoadingInitial && !initialGame) {
      setLocation("/");
    }
  }, [session, isLoadingInitial, initialGame, setLocation]);

  useEffect(() => {
    const latestRoll = game?.log.find((e) => e.kind === "roll");
    if (!latestRoll) return;
    if (lastRoll?.id === latestRoll.id) return;
    setLastRoll({ id: latestRoll.id, message: latestRoll.message });
    const timer = setTimeout(() => {
      setLastRoll((current) =>
        current?.id === latestRoll.id ? null : current,
      );
    }, 3500);
    return () => clearTimeout(timer);
  }, [game?.log, lastRoll?.id]);

  if (!session) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center p-4 bg-background dark text-center">
        <h2 className="text-2xl font-serif text-primary mb-4">You need to join this lobby</h2>
        <Button onClick={() => setLocation("/")}>Go to Home</Button>
      </div>
    );
  }

  const activeGame = game || initialGame;

  if (!activeGame) {
    return <div className="min-h-[100dvh] flex items-center justify-center bg-background dark text-muted-foreground">Loading...</div>;
  }

  const myPlayer = activeGame.players.find(p => p.id === session.playerId);
  const isHost = session.isHost;

  const copyCode = () => {
    navigator.clipboard.writeText(code);
  };

  const handleCommanderDamage = () => {
    if (selectedPlayerForDamage && damageDealerId) {
      sendAction({
        type: "commanderDamage",
        fromPlayerId: damageDealerId,
        toPlayerId: selectedPlayerForDamage.id,
        amount: damageAmount
      });
      setSelectedPlayerForDamage(null);
    }
  };

  const openDamageDialog = (player: Player) => {
    if (player.id === session.playerId) return; // Can't deal CD to self easily via UI, usually not needed
    setSelectedPlayerForDamage(player);
    setDamageDealerId(session.playerId);
    
    // Find current damage amount
    const currentEntry = activeGame.commanderDamage.find(
      cd => cd.toPlayerId === player.id && cd.fromPlayerId === session.playerId
    );
    setDamageAmount(currentEntry?.amount || 0);
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background dark text-foreground overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-border bg-card shadow-sm z-10">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-secondary px-3 py-1.5 rounded-md border border-border">
            <span className="font-mono text-xl tracking-widest text-primary font-bold">{code}</span>
            <button onClick={copyCode} className="text-muted-foreground hover:text-primary transition-colors p-1">
              <Copy className="w-4 h-4" />
            </button>
          </div>
          {!connected && (
            <span className="flex items-center gap-1 text-destructive text-sm font-medium animate-pulse">
              <WifiOff className="w-4 h-4" /> Reconnecting...
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {activeGame.status === "active" && (
            <div className="text-sm font-medium px-3 py-1 bg-accent/50 text-accent-foreground rounded-md border border-accent flex items-center gap-2">
              <Swords className="w-4 h-4" /> Turn {activeGame.turnNumber}
            </div>
          )}

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon" className="relative" title="Roll dice / flip coin">
                <Dices className="w-5 h-5" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Roll</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-3 gap-3 py-2">
                <Button
                  variant="outline"
                  className="h-24 flex flex-col gap-2"
                  onClick={() => sendAction({ type: "roll", kind: "coin" })}
                >
                  <Coins className="w-7 h-7" />
                  <span className="font-bold">Coin</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-24 flex flex-col gap-2"
                  onClick={() => sendAction({ type: "roll", kind: "d6" })}
                >
                  <Dices className="w-7 h-7" />
                  <span className="font-bold">D6</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-24 flex flex-col gap-2"
                  onClick={() => sendAction({ type: "roll", kind: "d20" })}
                >
                  <Dices className="w-7 h-7" />
                  <span className="font-bold">D20</span>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground text-center">Result is broadcast to everyone in the lobby.</p>
            </DialogContent>
          </Dialog>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon" className="relative">
                <BarChart2 className="w-5 h-5" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>Game Details</DialogTitle>
              </DialogHeader>
              <Tabs defaultValue="log" className="flex-1 flex flex-col min-h-0">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="log"><ScrollText className="w-4 h-4 mr-2"/> Log</TabsTrigger>
                  <TabsTrigger value="damage"><Shield className="w-4 h-4 mr-2"/> C. Damage</TabsTrigger>
                  <TabsTrigger value="stats"><Activity className="w-4 h-4 mr-2"/> Stats</TabsTrigger>
                </TabsList>
                <TabsContent value="log" className="flex-1 min-h-0 p-0 mt-4 border rounded-md">
                  <ScrollArea className="h-full p-4">
                    {activeGame.log.map((entry, i) => (
                      <div key={entry.id || i} className="mb-2 text-sm border-b border-border/50 pb-2 last:border-0">
                        <span className="text-muted-foreground text-xs font-mono mr-2">{new Date(entry.at).toLocaleTimeString()}</span>
                        <span className="text-foreground">{entry.message}</span>
                      </div>
                    ))}
                  </ScrollArea>
                </TabsContent>
                <TabsContent value="damage" className="flex-1 min-h-0 mt-4">
                  <div className="overflow-x-auto border rounded-md p-4 bg-card">
                    <table className="w-full text-sm text-left">
                      <thead>
                        <tr>
                          <th className="px-4 py-2 text-muted-foreground">To \ From</th>
                          {activeGame.players.map(p => (
                            <th key={p.id} className="px-4 py-2 font-medium" style={{ color: p.color }}>{p.name}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {activeGame.players.map(receiver => (
                          <tr key={receiver.id} className="border-t border-border/50">
                            <td className="px-4 py-3 font-medium" style={{ color: receiver.color }}>{receiver.name}</td>
                            {activeGame.players.map(dealer => {
                              if (receiver.id === dealer.id) return <td key={dealer.id} className="px-4 py-3 text-muted-foreground/30">-</td>;
                              const dmg = activeGame.commanderDamage.find(cd => cd.toPlayerId === receiver.id && cd.fromPlayerId === dealer.id)?.amount || 0;
                              return (
                                <td key={dealer.id} className={`px-4 py-3 font-bold ${dmg >= 21 ? 'text-destructive text-lg' : 'text-foreground'}`}>
                                  {dmg > 0 ? dmg : '-'}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>
                <TabsContent value="stats" className="flex-1 min-h-0 mt-4 space-y-4">
                  {initialStats && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Damage Dealt</CardTitle></CardHeader>
                        <CardContent>
                          {initialStats.totalDamageDealt.map(d => (
                            <div key={d.playerId} className="flex justify-between items-center mb-1">
                              <span>{d.playerName}</span>
                              <span className="font-bold">{d.total}</span>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Game Info</CardTitle></CardHeader>
                        <CardContent className="space-y-2">
                          <div className="flex justify-between"><span>Turns Played</span><span className="font-bold">{initialStats.turnsPlayed}</span></div>
                          <div className="flex justify-between"><span>Players Eliminated</span><span className="font-bold">{initialStats.eliminatedCount}</span></div>
                          {initialStats.biggestSingleHit && (
                            <div className="pt-2 border-t mt-2">
                              <span className="text-xs text-muted-foreground block mb-1">Biggest Hit</span>
                              <span className="font-bold">{initialStats.biggestSingleHit.amount} dmg</span>
                              <span className="text-sm text-muted-foreground ml-2">
                                ({initialStats.biggestSingleHit.fromPlayerName} → {initialStats.biggestSingleHit.toPlayerName})
                              </span>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>

          <Button variant="ghost" size="icon" onClick={() => { clearSession(code); setLocation("/"); }}>
            <LogOut className="w-5 h-5 text-muted-foreground" />
          </Button>
        </div>
      </header>

      {/* Host Controls Banner */}
      {isHost && (
        <div className="bg-secondary/40 border-b border-border p-2 flex items-center justify-center gap-4 flex-wrap">
          {activeGame.status === "waiting" && (
            <>
              <Button size="sm" variant="outline" onClick={() => sendAction({ type: "startGame" })}>
                <Play className="w-4 h-4 mr-2" /> Start Game
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={activeGame.players.length < 2}
                onClick={() => sendAction({ type: "randomizeOrder" })}
                title="Shuffle turn order"
              >
                <Shuffle className="w-4 h-4 mr-2" /> Randomize Order
              </Button>
              <div className="flex items-center gap-2 border-l pl-4 border-border">
                <span className="text-sm text-muted-foreground">Starting Life:</span>
                <Input 
                  type="number" 
                  value={activeGame.startingLife} 
                  onChange={(e) => sendAction({ type: "setStartingLife", value: Number(e.target.value) })}
                  className="w-20 h-8 text-center"
                />
              </div>
            </>
          )}
          {activeGame.status === "active" && (
            <>
              <Button size="sm" variant="outline" onClick={() => sendAction({ type: "nextTurn" })}>
                <FastForward className="w-4 h-4 mr-2" /> Next Turn
              </Button>
              <div className="flex items-center gap-2 border-l pl-4 border-border">
                <span className="text-sm text-muted-foreground">Set Turn:</span>
                <Select onValueChange={(v) => sendAction({ type: "setTurn", playerId: v })} value={activeGame.currentTurnPlayerId || undefined}>
                  <SelectTrigger className="w-32 h-8"><SelectValue placeholder="Player" /></SelectTrigger>
                  <SelectContent>
                    {activeGame.players.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10 ml-auto" onClick={() => sendAction({ type: "resetGame" })}>
            <RefreshCcw className="w-4 h-4 mr-2" /> Reset
          </Button>
        </div>
      )}

      {/* Turn Banner Animation */}
      <AnimatePresence>
        {activeGame.status === "active" && activeGame.currentTurnPlayerId && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-primary text-primary-foreground font-serif font-bold text-center py-2 text-lg shadow-md z-10"
          >
            Turn {activeGame.turnNumber} — {activeGame.players.find(p => p.id === activeGame.currentTurnPlayerId)?.name}'s Turn
          </motion.div>
        )}
      </AnimatePresence>

      {/* Roll Result Toast */}
      <AnimatePresence>
        {lastRoll && (
          <motion.div
            key={lastRoll.id}
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 320, damping: 24 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-card border-2 border-primary text-foreground px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 font-medium pointer-events-none"
          >
            <Dices className="w-5 h-5 text-primary" />
            <span>{lastRoll.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Board */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col">
        {activeGame.status === "waiting" && activeGame.players.length === 1 && (
          <div className="max-w-2xl mx-auto mb-8 text-center space-y-4 pt-12 flex-1 flex flex-col justify-center">
            <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Users className="w-12 h-12 text-primary" />
            </div>
            <h1 className="text-4xl font-serif text-primary">Lobby is open</h1>
            <p className="text-muted-foreground text-xl">Share the code <strong className="text-foreground font-mono text-2xl mx-2 px-3 py-1 bg-secondary rounded border">{code}</strong> to invite players.</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto w-full">
          {activeGame.players.map(player => {
            const isMe = player.id === session.playerId;
            const isTurn = activeGame.currentTurnPlayerId === player.id;
            
            return (
              <motion.div 
                layout
                key={player.id} 
                className={`relative flex flex-col rounded-xl overflow-hidden border-2 transition-colors duration-500 bg-card ${isTurn ? 'border-primary shadow-[0_0_30px_rgba(var(--primary),0.3)] z-10' : 'border-card-border'}`}
                style={{ '--player-color': player.color } as any}
                animate={isTurn ? { scale: 1.02 } : { scale: 1 }}
              >
                {/* Color bar */}
                <div className="h-3 w-full" style={{ backgroundColor: player.color }} />
                
                <div className="p-6 flex-1 flex flex-col items-center relative">
                  <AnimatePresence>
                    {player.isEliminated && (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="absolute inset-0 bg-background/85 backdrop-blur-[2px] z-20 flex flex-col items-center justify-center"
                      >
                        <Skull className="w-20 h-20 text-destructive mb-3 drop-shadow-md" />
                        <span className="text-3xl font-black text-destructive uppercase tracking-[0.3em] drop-shadow-sm">Eliminated</span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="flex items-center justify-between w-full mb-6">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-2xl tracking-tight" style={{ color: isTurn ? player.color : 'inherit' }}>{player.name}</span>
                      {isMe && <span className="text-xs font-bold uppercase px-2 py-0.5 bg-primary/20 text-primary rounded border border-primary/30">You</span>}
                      {player.isHost && <span className="text-xs uppercase px-2 py-0.5 bg-secondary text-muted-foreground rounded border border-border">Host</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      {isHost && !isMe && !player.isEliminated && (
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => sendAction({ type: "kickPlayer", playerId: player.id })}>
                          <LogOut className="w-3 h-3" />
                        </Button>
                      )}
                      <div className={`w-3 h-3 rounded-full shadow-sm ${player.isConnected ? 'bg-green-500 shadow-green-500/50' : 'bg-destructive shadow-destructive/50'}`} title={player.isConnected ? 'Connected' : 'Disconnected'} />
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col items-center justify-center w-full">
                    <div className="flex items-center justify-between w-full max-w-[320px]">
                      <div className="flex flex-col gap-4">
                        <Button variant="outline" size="icon" className="w-16 h-16 rounded-2xl bg-secondary border-secondary-foreground/10 text-2xl font-bold hover:bg-secondary/80 active:scale-95 transition-transform" onClick={() => sendAction({ type: "updateLife", playerId: player.id, delta: -5 })}>-5</Button>
                        <Button variant="outline" size="icon" className="w-16 h-16 rounded-2xl bg-secondary border-secondary-foreground/10 text-2xl font-bold hover:bg-secondary/80 active:scale-95 transition-transform" onClick={() => sendAction({ type: "updateLife", playerId: player.id, delta: -1 })}>-1</Button>
                      </div>
                      
                      <AnimatedLife life={player.life} />

                      <div className="flex flex-col gap-4">
                        <Button variant="outline" size="icon" className="w-16 h-16 rounded-2xl bg-secondary border-secondary-foreground/10 text-2xl font-bold hover:bg-secondary/80 active:scale-95 transition-transform" onClick={() => sendAction({ type: "updateLife", playerId: player.id, delta: 5 })}>+5</Button>
                        <Button variant="outline" size="icon" className="w-16 h-16 rounded-2xl bg-secondary border-secondary-foreground/10 text-2xl font-bold hover:bg-secondary/80 active:scale-95 transition-transform" onClick={() => sendAction({ type: "updateLife", playerId: player.id, delta: 1 })}>+1</Button>
                      </div>
                    </div>

                    {!isMe && (
                      <Button variant="ghost" className="mt-6 text-muted-foreground hover:text-foreground" onClick={() => openDamageDialog(player)}>
                        <Shield className="w-4 h-4 mr-2" /> Deal Cmdr Damage
                      </Button>
                    )}

                    {activeGame.players.length > 1 && (
                      <div className="mt-6 w-full">
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 text-center font-semibold">
                          Cmdr Damage Received
                        </div>
                        <div className="flex flex-wrap justify-center gap-1.5">
                          {activeGame.players
                            .filter(opp => opp.id !== player.id)
                            .map(opp => {
                              const dmg = activeGame.commanderDamage.find(
                                cd => cd.toPlayerId === player.id && cd.fromPlayerId === opp.id,
                              )?.amount || 0;
                              const lethal = dmg >= 21;
                              return (
                                <button
                                  key={opp.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedPlayerForDamage(player);
                                    setDamageDealerId(opp.id);
                                    setDamageAmount(dmg);
                                  }}
                                  className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs font-mono tabular-nums transition-colors ${
                                    lethal
                                      ? 'bg-destructive/20 border-destructive text-destructive font-bold'
                                      : dmg > 0
                                        ? 'bg-secondary border-border hover:border-foreground/40'
                                        : 'bg-secondary/40 border-border/40 text-muted-foreground hover:border-foreground/30'
                                  }`}
                                  title={`Damage from ${opp.name}`}
                                >
                                  <span
                                    className="w-2.5 h-2.5 rounded-full shrink-0"
                                    style={{ backgroundColor: opp.color }}
                                  />
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
          })}
        </div>
      </main>

      <Dialog open={!!selectedPlayerForDamage} onOpenChange={(o) => !o && setSelectedPlayerForDamage(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Commander Damage to {selectedPlayerForDamage?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Source Player</label>
              <Select value={damageDealerId} onValueChange={setDamageDealerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select player..." />
                </SelectTrigger>
                <SelectContent>
                  {activeGame.players.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name} {p.id === session.playerId ? '(You)' : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground flex justify-between">
                <span>Total Damage (≥21 eliminates)</span>
                <span className="font-bold text-destructive">{damageAmount}/21</span>
              </label>
              <div className="flex items-center justify-center gap-4">
                <Button variant="outline" size="icon" className="w-12 h-12 rounded-full" onClick={() => setDamageAmount(Math.max(0, damageAmount - 1))}>-1</Button>
                <span className="text-4xl font-bold tabular-nums w-16 text-center">{damageAmount}</span>
                <Button variant="outline" size="icon" className="w-12 h-12 rounded-full" onClick={() => setDamageAmount(damageAmount + 1)}>+1</Button>
              </div>
            </div>

            <Button className="w-full font-bold text-lg h-12" onClick={handleCommanderDamage}>
              Apply Damage
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
