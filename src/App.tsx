/* eslint-disable @typescript-eslint/no-unused-vars */
import { useState, useEffect } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "./components/ui/alert";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Leaderboard } from "./leaderboard";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  useAccount,
  useWalletClient,
  useReadContract,
  useWriteContract,
  type BaseError,
} from "wagmi";

const CONTRACT_ADDRESS = "0x5ed4c558469A94bbd52a70a7cb54CE04915324BB";
interface GameStatus {
  isActive: boolean;
  remainingTime: bigint;
  startTime: bigint;
}

interface PlayerAttempts {
  guesses: string[];
  results: string[][];
}

interface PlayerStats {
  gamesWon: bigint;
  currentStreak: bigint;
  bestStreak: bigint;
  totalPrizesWon: bigint;
}

interface Stats {
  gamesWon: number;
  currentStreak: number;
  bestStreak: number;
}

const CONTRACT_ABI = [
  {
    name: "currentWord",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    name: "makeAttempt",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "guess", type: "string" }],
    outputs: [],
  },
  {
    name: "getPlayerAttempts",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "player", type: "address" }],
    outputs: [
      { name: "guesses", type: "string[]" },
      { name: "results", type: "uint8[5][]" },
    ],
  },
  {
    name: "gameActive",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bool" }],
  },
  {
    name: "playerStats",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "player", type: "address" }],
    outputs: [
      { name: "gamesWon", type: "uint256" },
      { name: "currentStreak", type: "uint256" },
      { name: "bestStreak", type: "uint256" },
      { name: "totalPrizesWon", type: "uint256" },
    ],
  },
  {
    name: "getGameStatus",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "isActive", type: "bool" },
      { name: "remainingTime", type: "uint256" },
      { name: "startTime", type: "uint256" },
    ],
  },
  {
    name: "getPlayerCount",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
] as const;

function App() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const {
    writeContract,
    isPending: isWritePending,
    error: readError,
  } = useWriteContract();
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [lastGameStartTime, setLastGameStartTime] = useState<number>(0);
  const [currentGuess, setCurrentGuess] = useState<string>("");
  const [attempts, setAttempts] = useState<string[]>([]);
  const [results, setResults] = useState<string[][]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [stats, setStats] = useState<Stats>({
    gamesWon: 0,
    currentStreak: 0,
    bestStreak: 0,
  });
  const [isGameActive, setIsGameActive] = useState<boolean>(false);

  const formatTimeRemaining = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const { data: gameStatus, isError: isGameStatusError } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "getGameStatus",
  });

  const { data: playerAttempts, isError: isPlayerAttemptsError } =
    useReadContract({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: "getPlayerAttempts",
      args: address ? [address] : undefined,
    }) as { data: PlayerAttempts | undefined; isError: boolean };

  const { data: playerStats, isError: isPlayerStatsError } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "playerStats",
    args: address ? [address] : undefined,
  }) as { data: PlayerStats | undefined; isError: boolean };

  const safeBigIntToNumber = (value: bigint | undefined): number => {
    if (!value) return 0;
    try {
      const num = Number(value);
      return isNaN(num) ? 0 : num;
    } catch {
      return 0;
    }
  };

  useEffect(() => {
    if (gameStatus) {
      const [active, remaining, start] = gameStatus;
      const remainingTime = Number(remaining);
      const startTime = Number(start);
      setIsGameActive(active);
      setTimeRemaining(Number(remainingTime));
      setLastGameStartTime(Number(startTime));

      console.log("Game Status Updated:", {
        active,
        remainingTime,
        startTime,
      });
    }
  }, [gameStatus]);

  useEffect(() => {
    if (playerAttempts) {
      // Make sure we have valid data before setting state
      const { guesses, results } = playerAttempts;
      if (Array.isArray(guesses) && Array.isArray(results)) {
        setAttempts(guesses);
        setResults(results);
      }
    }
  }, [playerAttempts]);

  useEffect(() => {
    if (playerAttempts || isPlayerAttemptsError) {
      setIsLoading(false);
    }
  }, [playerAttempts, isPlayerAttemptsError]);

  useEffect(() => {
    if (playerStats) {
      try {
        setStats({
          gamesWon: safeBigIntToNumber(playerStats.gamesWon),
          currentStreak: safeBigIntToNumber(playerStats.currentStreak),
          bestStreak: safeBigIntToNumber(playerStats.bestStreak),
        });
      } catch (error) {
        console.error("Error converting player stats:", error);
        // Set default values if conversion fails
        setStats({
          gamesWon: 0,
          currentStreak: 0,
          bestStreak: 0,
        });
      }
    }
  }, [playerStats]);

  useEffect(() => {
    if (timeRemaining && timeRemaining > 0 && isGameActive) {
      const timer = setInterval(() => {
        setTimeRemaining((prev) => {
          if (!prev || prev <= 1) {
            clearInterval(timer);
            setIsGameActive(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [timeRemaining, isGameActive]);

  const makeGuess = async () => {
    if (!currentGuess || currentGuess.length !== 5) {
      setError("Please enter a 5-letter word");
      return;
    }

    setError("");

    try {
      if (!walletClient) throw new Error("No wallet connected");

      // const hash = await
      writeContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "makeAttempt",
        args: [currentGuess.toUpperCase()],
      });

      // console.log(hash);

      setCurrentGuess("");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      setError(error.message || "Failed to submit guess");
      console.error(error);
    }
  };

  const getColorForResult = (result: string) => {
    switch (result) {
      case "2":
        return "bg-green-500";
      case "1":
        return "bg-yellow-500";
      default:
        return "bg-gray-500";
    }
  };

  const debugGameStatus = () => {
    console.log({
      gameStatusRaw: gameStatus,
      parsedStatus: gameStatus
        ? {
            isActive: gameStatus[0],
            remainingTime: Number(gameStatus[1]),
            startTime: Number(gameStatus[2]),
          }
        : null,
      currentState: {
        isGameActive,
        timeRemaining,
        lastGameStartTime,
      },
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-lg mx-auto p-4">
        {isConnected && (
          <Button
            onClick={debugGameStatus}
            variant="outline"
            size="sm"
            className="mb-4"
          >
            Debug Game Status
          </Button>
        )}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center text-blue-600">
              Web3WordleWorldwide
            </CardTitle>
            <CardDescription className="text-center">
              {isGameActive ? (
                <>
                  Guess the 5-letter word in 6 tries or less
                  {timeRemaining !== null && timeRemaining > 0 && (
                    <div className="mt-2 text-sm font-medium text-gray-500">
                      Time remaining: {formatTimeRemaining(timeRemaining)}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-yellow-600">
                  No active game. Please wait for the next game to start.
                </div>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!isConnected ? (
              <div className="flex flex-col items-center space-y-4">
                <ConnectButton />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Game Input */}
                <div className="flex space-x-2">
                  <Input
                    type="text"
                    maxLength={5}
                    value={currentGuess}
                    onChange={(e) =>
                      setCurrentGuess(e.target.value.toLowerCase())
                    }
                    placeholder="Enter your guess"
                    className="uppercase text-center font-mono text-lg"
                    disabled={isWritePending}
                  />
                  <Button
                    onClick={makeGuess}
                    disabled={
                      !isGameActive || isWritePending || attempts.length >= 6
                    }
                    className="min-w-24"
                  >
                    {isWritePending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Wait...
                      </>
                    ) : (
                      "Guess"
                    )}
                  </Button>
                </div>

                {isLoading ? (
                  <div className="flex justify-center items-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                  </div>
                ) : (
                  <>
                    {/* Game Board */}
                    <div className="grid place-items-center">
                      <div className="space-y-2">
                        {attempts &&
                          attempts.map((guess, i) => (
                            <div key={i} className="flex space-x-2">
                              {guess.split("").map((letter, j) => (
                                <div
                                  key={j}
                                  className={`w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center text-white font-bold rounded text-xl transition-colors ${
                                    results[i]
                                      ? getColorForResult(results[i][j])
                                      : "bg-gray-200"
                                  }`}
                                >
                                  {letter.toUpperCase()}
                                </div>
                              ))}
                            </div>
                          ))}

                        {/* Empty rows */}
                        {attempts &&
                          [...Array(6 - attempts.length)].map((_, i) => (
                            <div key={i} className="flex space-x-2">
                              {[...Array(5)].map((_, j) => (
                                <div
                                  key={j}
                                  className="w-12 h-12 sm:w-14 sm:h-14 border-2 border-gray-200 rounded transition-colors"
                                />
                              ))}
                            </div>
                          ))}
                      </div>
                    </div>
                  </>
                )}

                {/* Error Display */}
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                {readError && (
                  <div>
                    Error:{" "}
                    {(readError as BaseError).shortMessage || readError.message}
                  </div>
                )}
              </div>
            )}
          </CardContent>
          {isConnected && (
            <CardFooter>
              <div className="w-full grid grid-cols-3 gap-4 mt-4">
                <div className="bg-white p-4 rounded-lg shadow-sm text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {stats.gamesWon.toString()}
                  </div>
                  <div className="text-sm text-gray-600">Won</div>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {stats.currentStreak.toString()}
                  </div>
                  <div className="text-sm text-gray-600">Streak</div>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {stats.bestStreak.toString()}
                  </div>
                  <div className="text-sm text-gray-600">Best</div>
                </div>
              </div>
            </CardFooter>
          )}
        </Card>
        {/* Add the Leaderboard component */}
        {isConnected && (
          <Leaderboard contract={CONTRACT_ADDRESS} isConnected={isConnected} />
        )}
      </div>
    </div>
  );
}

export default App;
