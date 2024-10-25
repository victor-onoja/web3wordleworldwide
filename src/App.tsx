// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const window: any;

import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { AlertCircle, Loader2, WalletIcon } from "lucide-react";
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

const CONTRACT_ADDRESS = "0x7C63A3F492Ac704a458C300cA3777cC22B91f0Ec";
const CONTRACT_ABI = [
  "function currentWord() public view returns (string)",
  "function makeAttempt(string memory guess) external",
  "function getPlayerAttempts(address player) external view returns (string[] memory guesses, uint8[5][] memory results)",
  "function gameActive() public view returns (bool)",
  "function playerStats(address) public view returns (uint256 gamesWon, uint256 currentStreak, uint256 bestStreak, uint256 totalPrizesWon)",
  "function getTopPlayers(uint256 limit) external view returns (address[] memory players, uint256[] memory scores)",
  "function getGameStatus() external view returns (bool isActive, uint256 remainingTime, uint256 startTime)",
  "function getPlayerCount() external view returns (uint256)",
];

interface PlayerStats {
  gamesWon: number;
  currentStreak: number;
  bestStreak: number;
}

function App() {
  const [, setGameEndTime] = useState<number>(0);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [lastGameStartTime, setLastGameStartTime] = useState<number>(0);
  const [currentGuess, setCurrentGuess] = useState<string>("");
  const [attempts, setAttempts] = useState<string[]>([]);
  const [results, setResults] = useState<number[][]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [account, setAccount] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [stats, setStats] = useState<PlayerStats>({
    gamesWon: 0,
    currentStreak: 0,
    bestStreak: 0,
  });
  const [isGameActive, setIsGameActive] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [transactionPending, setTransactionPending] = useState<boolean>(false);

  const formatTimeRemaining = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    checkConnection();
    if (isConnected) {
      loadGameState();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, account]);

  useEffect(() => {
    if (isConnected) {
      loadGameState();

      // Poll every minute for game state changes
      const pollInterval = setInterval(() => {
        loadGameState();
      }, 60000); // Check every minute

      return () => clearInterval(pollInterval);
    }
  }, [isConnected, account]);

  useEffect(() => {
    const checkGameStatus = async () => {
      try {
        const provider = new ethers.providers.Web3Provider(window.ethereum, {
          name: "arbitrum-sepolia",
          chainId: 421614,
        });

        const contract = new ethers.Contract(
          CONTRACT_ADDRESS,
          CONTRACT_ABI,
          provider
        );

        const status = await contract.getGameStatus();
        setIsGameActive(status.isActive);
        setGameEndTime(status.startTime.toNumber() + 3600); // 1 hour in seconds

        // Set up timer to check game status
        if (status.isActive) {
          const timer = setTimeout(() => {
            loadGameState();
          }, status.remainingTime.toNumber() * 1000);

          return () => clearTimeout(timer);
        }
      } catch (error) {
        console.error("Error checking game status:", error);
      }
    };

    if (isConnected) {
      checkGameStatus();
    }
  }, [isConnected]);

  useEffect(() => {
    if (timeRemaining && timeRemaining > 0) {
      const timer = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev === null || prev <= 1) {
            clearInterval(timer);
            // Reload game state when timer hits 0
            loadGameState();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [timeRemaining]);

  const checkConnection = async () => {
    try {
      if (window.ethereum) {
        const provider = new ethers.providers.Web3Provider(window.ethereum, {
          name: "arbitrum-sepolia",
          chainId: 421614,
        });
        const accounts = await provider.listAccounts();
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          setIsConnected(true);
        }
      }
    } catch (error) {
      console.error("Connection error:", error);
    } finally {
      setIsInitializing(false);
    }
  };

  const connectWallet = async () => {
    setIsLoading(true);
    try {
      if (window.ethereum) {
        const provider = new ethers.providers.Web3Provider(window.ethereum, {
          name: "arbitrum-sepolia",
          chainId: 421614,
        });
        await provider.send("eth_requestAccounts", []);
        const signer = provider.getSigner();
        const address = await signer.getAddress();
        setAccount(address);
        setIsConnected(true);
      } else {
        setError("Please install MetaMask!");
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      setError("Failed to connect wallet.");
    } finally {
      setIsLoading(false);
    }
  };

  const loadGameState = async () => {
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum, {
        name: "arbitrum-sepolia",
        chainId: 421614,
      });

      const contract = new ethers.Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        provider
      );

      // Load game state
      const status = await contract.getGameStatus();
      setIsGameActive(status.isActive);
      setLastGameStartTime(status.startTime.toNumber());
      setTimeRemaining(status.remainingTime.toNumber());

      // Load player attempts
      if (account) {
        const [guesses, attemptResults] = await contract.getPlayerAttempts(
          account
        );
        setAttempts(guesses);
        setResults(attemptResults);

        // Load player stats
        const playerStats = await contract.playerStats(account);
        setStats({
          gamesWon: playerStats.gamesWon.toNumber(),
          currentStreak: playerStats.currentStreak.toNumber(),
          bestStreak: playerStats.bestStreak.toNumber(),
        });
      }
    } catch (error) {
      console.log(account);
      console.error("Error loading game state:", error);
    }
  };

  const makeGuess = async () => {
    if (!currentGuess || currentGuess.length !== 5) {
      setError("Please enter a 5-letter word");
      return;
    }

    // setIsLoading(true);
    setTransactionPending(true);
    setError("");

    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum, {
        name: "arbitrum-sepolia",
        chainId: 421614,
      });
      const signer = provider.getSigner();
      const contract = new ethers.Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        signer
      );

      const tx = await contract.makeAttempt(currentGuess.toUpperCase());
      await tx.wait();

      setCurrentGuess("");
      await loadGameState();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      setError(error.message || "Failed to submit guess");
      console.error(error);
    } finally {
      // setIsLoading(false);
      setTransactionPending(false);
    }
  };

  const getColorForResult = (result: number) => {
    switch (result) {
      case 2:
        return "bg-green-500";
      case 1:
        return "bg-yellow-500";
      default:
        return "bg-gray-500";
    }
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  function getProvider():
    | ethers.providers.Provider
    | ethers.Signer
    | undefined {
    if (!window.ethereum) throw new Error("Please install MetaMask!");

    const provider = new ethers.providers.Web3Provider(window.ethereum, {
      name: "arbitrum-sepolia",
      chainId: 421614,
    });

    return provider;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-lg mx-auto p-4">
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
                <Button
                  onClick={connectWallet}
                  className="w-full max-w-xs"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <WalletIcon className="mr-2 h-4 w-4" /> Connect Wallet
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Connected Account Display */}
                <div className="text-sm text-center text-gray-500">
                  Connected: {account.slice(0, 6)}...{account.slice(-4)}
                </div>

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
                    disabled={transactionPending}
                  />
                  <Button
                    onClick={makeGuess}
                    disabled={
                      !isGameActive ||
                      transactionPending ||
                      attempts.length >= 6
                    }
                    className="min-w-24"
                  >
                    {transactionPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Wait...
                      </>
                    ) : (
                      "Guess"
                    )}
                  </Button>
                </div>

                {/* Game Board */}
                <div className="grid place-items-center">
                  <div className="space-y-2">
                    {attempts.map((guess, i) => (
                      <div key={i} className="flex space-x-2">
                        {guess.split("").map((letter, j) => (
                          <div
                            key={j}
                            className={`w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center text-white font-bold rounded text-xl transition-colors ${getColorForResult(
                              results[i][j]
                            )}`}
                          >
                            {letter.toUpperCase()}
                          </div>
                        ))}
                      </div>
                    ))}

                    {/* Empty rows */}
                    {[...Array(6 - attempts.length)].map((_, i) => (
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

                {/* Error Display */}
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </CardContent>
          {isConnected && (
            <CardFooter>
              <div className="w-full grid grid-cols-3 gap-4 mt-4">
                <div className="bg-white p-4 rounded-lg shadow-sm text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {stats.gamesWon}
                  </div>
                  <div className="text-sm text-gray-600">Won</div>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {stats.currentStreak}
                  </div>
                  <div className="text-sm text-gray-600">Streak</div>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {stats.bestStreak}
                  </div>
                  <div className="text-sm text-gray-600">Best</div>
                </div>
              </div>
            </CardFooter>
          )}
        </Card>
        {/* Add the Leaderboard component */}
        {isConnected && (
          <Leaderboard
            contract={
              new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, getProvider())
            }
            provider={getProvider()}
            isConnected={isConnected}
            key={lastGameStartTime}
          />
        )}
      </div>
    </div>
  );
}

export default App;
