/* eslint-disable @typescript-eslint/no-unused-vars */
import { useState } from "react";
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
import { useReadContract } from "wagmi";

interface LeaderboardProps {
  contract: `0x${string}`;
  isConnected: boolean;
}

interface PlayerScore {
  address: `0x${string}`;
  score: number;
  rank: number;
}

type TopPlayersResponse = readonly [`0x${string}`[], bigint[]];

const LEADERBOARD_ABI = [
  {
    name: "getTopPlayers",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "limit", type: "uint256" }],
    outputs: [
      { name: "players", type: "address[]" },
      { name: "scores", type: "uint256[]" },
    ],
  },
] as const;

const rankIcons = {
  1: <Trophy className="h-5 w-5 text-yellow-500" />,
  2: <Medal className="h-5 w-5 text-gray-400" />,
  3: <Award className="h-5 w-5 text-amber-600" />,
} as const;

export function Leaderboard({ contract, isConnected }: LeaderboardProps) {
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: topPlayersData, isLoading } = useReadContract({
    address: contract,
    abi: LEADERBOARD_ABI,
    functionName: "getTopPlayers",
    args: [10n],
  }) as { data: TopPlayersResponse | undefined; isLoading: boolean };

  // Transform data only if it exists and has the correct structure
  const topPlayers: PlayerScore[] = (() => {
    if (!topPlayersData) {
      return [];
    }

    const [players, scores] = topPlayersData;
    const seenAddresses = new Set<string>();
    return players
      .map((address, index) => ({
        address,
        score: Number(scores[index]),
        rank: index + 1,
      }))
      .filter((player) => {
        // Only keep the first occurrence of each address
        if (seenAddresses.has(player.address)) {
          return false;
        }
        seenAddresses.add(player.address);
        return true;
      })
      .map((player, index) => ({
        ...player,
        rank: index + 1, // Recalculate ranks after deduplication
      }));
  })();

  // Add debug function
  const debugLeaderboard = () => {
    console.log({
      topPlayersData,
      topPlayers,
    });
  };

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
            onClick={debugLeaderboard}
            className="ml-2"
          >
            Debug
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Refresh"
            )}
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
              loading={isLoading}
              title="Today's Top Players"
            />
          </TabsContent>

          <TabsContent value="allTime">
            <LeaderboardTable
              players={topPlayers}
              loading={isLoading}
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

function LeaderboardTable({ players, loading }: LeaderboardTableProps) {
  if (loading) {
    return (
      <div className="flex justify-center items-center h-48">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!players || players.length === 0) {
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
