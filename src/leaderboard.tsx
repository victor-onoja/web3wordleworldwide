/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Trophy, Medal, Award, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface LeaderboardProps {
  contract: any;
  provider: any;
  isConnected: boolean;
}

interface PlayerScore {
  address: string;
  score: number;
  rank: number;
}

const rankIcons = {
  1: <Trophy className="h-5 w-5 text-yellow-500" />,
  2: <Medal className="h-5 w-5 text-gray-400" />,
  3: <Award className="h-5 w-5 text-amber-600" />,
};

export function Leaderboard({
  contract,
  provider,
  isConnected,
}: LeaderboardProps) {
  const [loading, setLoading] = useState(true);
  const [topPlayers, setTopPlayers] = useState<PlayerScore[]>([]);
  const [activeTab, setActiveTab] = useState("daily");
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      // Fetch top 10 players
      const [addresses, scores] = await contract.getTopPlayers(10);

      const formattedScores: PlayerScore[] = addresses.map(
        (address: string, index: number) => ({
          address,
          score: scores[index].toNumber(),
          rank: index + 1,
        })
      );

      setTopPlayers(formattedScores);
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isConnected && contract) {
      fetchLeaderboard();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey, contract, isConnected]);

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  if (!isConnected) {
    return null;
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="text-xl font-bold">Leaderboard</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
          </Button>
        </div>
        <CardDescription>Top players by performance</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="daily" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="daily">Daily</TabsTrigger>
            <TabsTrigger value="allTime">All Time</TabsTrigger>
          </TabsList>

          <TabsContent value="daily">
            <LeaderboardTable
              players={topPlayers}
              loading={loading}
              title="Today's Top Players"
            />
          </TabsContent>

          <TabsContent value="allTime">
            <LeaderboardTable
              players={topPlayers}
              loading={loading}
              title="All-Time Champions"
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

interface LeaderboardTableProps {
  players: PlayerScore[];
  loading: boolean;
  title: string;
}

function LeaderboardTable({ players, loading, title }: LeaderboardTableProps) {
  if (loading) {
    return (
      <div className="flex justify-center items-center h-48">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (players.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">No players found</div>
    );
  }

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-16">Rank</TableHead>
          <TableHead>Player</TableHead>
          <TableHead className="text-right">Score</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {players.map((player) => (
          <TableRow key={player.address} className="hover:bg-gray-50">
            <TableCell className="font-medium">
              <div className="flex items-center gap-2">
                {rankIcons[player.rank as keyof typeof rankIcons] ||
                  player.rank}
              </div>
            </TableCell>
            <TableCell className="font-mono">
              {formatAddress(player.address)}
            </TableCell>
            <TableCell className="text-right">{player.score}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
