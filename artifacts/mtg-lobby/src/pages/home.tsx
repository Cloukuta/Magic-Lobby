import { useState } from "react";
import { useLocation } from "wouter";
import { useCreateGame, useJoinGame } from "@workspace/api-client-react";
import { saveSession } from "../hooks/use-game-socket"; // we'll move storage out or just use it
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import logoUrl from "@assets/summonerdeck_1777491015118.webp";

export default function Home() {
  const [, setLocation] = useLocation();
  const createGame = useCreateGame();
  const joinGame = useJoinGame();

  const [createName, setCreateName] = useState("");
  const [createLife, setCreateLife] = useState(40);

  const [joinCode, setJoinCode] = useState("");
  const [joinName, setJoinName] = useState("");

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName) return;
    createGame.mutate({ data: { hostName: createName, startingLife: createLife } }, {
      onSuccess: (res) => {
        saveSession({ token: res.token, playerId: res.playerId, code: res.game.code, isHost: true });
        setLocation(`/lobby/${res.game.code}`);
      }
    });
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode || !joinName) return;
    joinGame.mutate({ code: joinCode.toUpperCase(), data: { name: joinName } }, {
      onSuccess: (res) => {
        saveSession({ token: res.token, playerId: res.playerId, code: res.game.code, isHost: false });
        setLocation(`/lobby/${res.game.code}`);
      }
    });
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-4 bg-background dark">
      <Card className="w-full max-w-md border-primary/20 shadow-2xl shadow-primary/10">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-24 h-24 rounded-2xl overflow-hidden border border-primary/20 shadow-lg shadow-primary/10">
            <img src={logoUrl} alt="Summoner's Deck" className="w-full h-full object-cover" />
          </div>
          <div>
            <CardTitle className="text-3xl font-serif text-primary">Commander Lobby</CardTitle>
            <CardDescription className="text-muted-foreground mt-2">Real-time companion for EDH pods</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="join" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6 bg-secondary/50">
              <TabsTrigger value="join">Join Game</TabsTrigger>
              <TabsTrigger value="create">Host Game</TabsTrigger>
            </TabsList>
            
            <TabsContent value="join">
              <form onSubmit={handleJoin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="join-code">Lobby Code</Label>
                  <Input 
                    id="join-code" 
                    placeholder="e.g. ABCD" 
                    value={joinCode} 
                    onChange={e => setJoinCode(e.target.value.toUpperCase())}
                    maxLength={4}
                    className="font-mono uppercase text-lg text-center tracking-widest"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="join-name">Your Name</Label>
                  <Input 
                    id="join-name" 
                    placeholder="e.g. Urza" 
                    value={joinName} 
                    onChange={e => setJoinName(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full font-bold" disabled={joinGame.isPending}>
                  {joinGame.isPending ? "Joining..." : "Join Lobby"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="create">
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="create-name">Your Name (Host)</Label>
                  <Input 
                    id="create-name" 
                    placeholder="e.g. Yawgmoth" 
                    value={createName} 
                    onChange={e => setCreateName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-life">Starting Life</Label>
                  <Input 
                    id="create-life" 
                    type="number" 
                    value={createLife} 
                    onChange={e => setCreateLife(Number(e.target.value))}
                  />
                </div>
                <Button type="submit" className="w-full font-bold" disabled={createGame.isPending}>
                  {createGame.isPending ? "Creating..." : "Create Lobby"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
