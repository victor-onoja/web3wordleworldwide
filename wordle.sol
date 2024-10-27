// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { IERC20 } from "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC20/IERC20.sol";
import { Ownable } from "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/utils/ReentrancyGuard.sol";
import { Strings } from "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/utils/Strings.sol";

contract Wordle is Ownable, ReentrancyGuard {
    using Strings for uint256;

    IERC20 public usdcToken;
    
    uint256 public constant WORD_LENGTH = 5;
    uint256 public constant MAX_ATTEMPTS = 6;
    uint256 public entryFee = 1e6; // 1 USDC
    uint256 public constant GAME_DURATION = 30 minutes; // Reduced for testing
    
    string public currentWord; // Made public for testing
    uint256 public gameStartTime;
    uint256 public prizePool;
    bool public gameActive;
    uint256 public playerCount;
    address[] public playerAddresses;

    struct PlayerAttempt {
        string guess;
        uint256 timestamp;
        uint8[5] result;
    }
    
    struct PlayerStats {
        uint256 gamesWon;
        uint256 currentStreak;
        uint256 bestStreak;
        uint256 totalPrizesWon;
    }

    struct PlayerRanking {
        address playerAddress;
        uint256 score;
    }

    mapping(address => PlayerStats) public playerStats;
    mapping(address => PlayerAttempt[]) public playerAttempts;
    mapping(uint256 => address[]) public dailyWinners;
    mapping(address => uint256) public playerLastGameTimestamp;
    
    event GameStarted(uint256 indexed gameId, uint256 startTime);
    event AttemptMade(address indexed player, uint256 attemptNumber, uint8[5] result);
    event GameWon(address indexed player, uint256 attempts, uint256 timeSpent);
    event PrizeDistributed(address indexed player, uint256 amount);
    event GameEnded(uint256 indexed gameId, uint256 endTime);
    event NextGameScheduled(uint256 indexed gameId, uint256 startTime);
    
    constructor(address _usdcToken) Ownable(msg.sender) {
        usdcToken = IERC20(_usdcToken);
        playerCount = 0;
    }

    function _addNewPlayer(address player) private {
        // Check if player already exists
        bool playerExists = false;
        for (uint256 i = 0; i < playerCount; i++) {
            if (playerAddresses[i] == player) {
                playerExists = true;
                break;
            }
        }
        
        if (!playerExists) {
            playerAddresses.push(player);
            playerCount++;
        }
    }

    function resetGame() external onlyOwner {
        gameActive = false;
        currentWord = "";
        gameStartTime = 0;
        prizePool = 0;
        
        // Clear all player attempts for the current game
        for (uint256 i = 0; i < playerCount; i++) {
            address player = playerAddresses[i];
            delete playerAttempts[player];
            playerLastGameTimestamp[player] = 0;
        }
    }

    // Testing function - set entry fee to 0
    function setEntryFeeForTesting(uint256 newFee) external onlyOwner {
        entryFee = newFee;
    }

    function startNewGame(string memory word) external onlyOwner {
        require(!gameActive, "Current game still active");
        require(bytes(word).length == WORD_LENGTH, "Invalid word length");
        
        currentWord = word;
        gameStartTime = block.timestamp;
        gameActive = true;
        prizePool = 0;
        
        emit GameStarted(block.timestamp, gameStartTime);
    }
    
    function makeAttempt(string memory guess) external nonReentrant {
        require(gameActive && !isGameExpired(), "No active game or game expired");
        require(bytes(guess).length == WORD_LENGTH, "Invalid word length");

        // Reset attempts if player is starting a new game
        if (playerLastGameTimestamp[msg.sender] < gameStartTime) {
            delete playerAttempts[msg.sender];
            playerLastGameTimestamp[msg.sender] = gameStartTime;
        }
        
        require(playerAttempts[msg.sender].length < MAX_ATTEMPTS, "Max attempts reached");

         // Add new player if first attempt
        if (playerAttempts[msg.sender].length == 0) {
            _addNewPlayer(msg.sender);
        }
        
        // Only charge entry fee if it's not zero (for testing)
        if (entryFee > 0 && playerAttempts[msg.sender].length == 0) {
            require(usdcToken.transferFrom(msg.sender, address(this), entryFee), "Entry fee transfer failed");
            prizePool += entryFee;
        }
        
        uint8[5] memory result = calculateResult(guess);
        playerAttempts[msg.sender].push(PlayerAttempt({
            guess: guess,
            timestamp: block.timestamp,
            result: result
        }));
        
        emit AttemptMade(msg.sender, playerAttempts[msg.sender].length, result);
        
        if (isWordCorrect(result)) {
            handleWin(msg.sender);
        }
    }
    
    function calculateResult(string memory guess) public view returns (uint8[5] memory) {
        uint8[5] memory result;
        bytes memory guessBytes = bytes(guess);
        bytes memory targetBytes = bytes(currentWord);
        
        // First pass: Mark correct positions
        for (uint i = 0; i < WORD_LENGTH; i++) {
            if (guessBytes[i] == targetBytes[i]) {
                result[i] = 2;
            }
        }
        
        // Second pass: Mark correct letters in wrong positions
        for (uint i = 0; i < WORD_LENGTH; i++) {
            if (result[i] == 2) continue;
            
            for (uint j = 0; j < WORD_LENGTH; j++) {
                if (j != i && guessBytes[i] == targetBytes[j]) {
                    result[i] = 1;
                    break;
                }
            }
        }
        
        return result;
    }
    
    function isWordCorrect(uint8[5] memory result) private pure returns (bool) {
        for (uint i = 0; i < WORD_LENGTH; i++) {
            if (result[i] != 2) return false;
        }
        return true;
    }
    
    function handleWin(address player) private {
        PlayerStats storage stats = playerStats[player];
        stats.gamesWon++;
        stats.currentStreak++;
        if (stats.currentStreak > stats.bestStreak) {
            stats.bestStreak = stats.currentStreak;
        }
        
        uint256 timeSpent = block.timestamp - gameStartTime;
        emit GameWon(player, playerAttempts[player].length, timeSpent);
        
        uint256 currentDay = block.timestamp / 1 days;
        dailyWinners[currentDay].push(player);
    }
    
    function getPlayerAttempts(address player) external view returns (string[] memory guesses, uint8[5][] memory results) {
        PlayerAttempt[] storage attempts = playerAttempts[player];
        guesses = new string[](attempts.length);
        results = new uint8[5][](attempts.length);
        
        for (uint i = 0; i < attempts.length; i++) {
            guesses[i] = attempts[i].guess;
            results[i] = attempts[i].result;
        }
    }
    
    // Emergency functions
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = usdcToken.balanceOf(address(this));
        require(usdcToken.transfer(owner(), balance), "Emergency withdrawal failed");
    }

    // Get total number of players
    function getPlayerCount() external view returns (uint256) {
        return playerCount;
    }

    function isGameExpired() public view returns (bool) {
        return block.timestamp >= gameStartTime + GAME_DURATION;
    }

    // Get top players based on their total wins and current streak
    function getTopPlayers(uint256 limit) external view returns (address[] memory players, uint256[] memory scores) {
        // Create a temporary array to store all players and their scores
        PlayerRanking[] memory rankings = new PlayerRanking[](playerCount);
        uint256 count = 0;
    
        // Calculate scores for each player
        for (uint256 i = 0; i < playerCount; i++) {
        address playerAddress = playerAddresses[i];
        PlayerStats storage stats = playerStats[playerAddress];
        
        // Score calculation: wins * 10 + current streak
        uint256 score = (stats.gamesWon * 10) + stats.currentStreak;
        
        rankings[count] = PlayerRanking({
            playerAddress: playerAddress,
            score: score
        });
        count++;
    }
    
    // Sort rankings (simple bubble sort for demonstration)
    for (uint256 i = 0; i < count - 1; i++) {
        for (uint256 j = 0; j < count - i - 1; j++) {
            if (rankings[j].score < rankings[j + 1].score) {
                PlayerRanking memory temp = rankings[j];
                rankings[j] = rankings[j + 1];
                rankings[j + 1] = temp;
            }
        }
    }
    
    // Determine how many players to return
    uint256 resultCount = limit < count ? limit : count;
    
    // Create return arrays
    players = new address[](resultCount);
    scores = new uint256[](resultCount);
    
    // Fill return arrays
    for (uint256 i = 0; i < resultCount; i++) {
        players[i] = rankings[i].playerAddress;
        scores[i] = rankings[i].score;
    }
    
    return (players, scores);
    }

    function getGameStatus() external view returns (
        bool isActive,
        uint256 remainingTime,
        uint256 startTime
    ) {
        uint256 endTime = gameStartTime + GAME_DURATION;
        bool expired = block.timestamp >= endTime;
        uint256 remaining = expired ? 0 : endTime - block.timestamp;
    
    return (
        !expired,
        remaining,
        gameStartTime
    );
    }

    function endGame() external {
        require(gameActive && isGameExpired(), "Game not active or not expired");
        gameActive = false;
        // Distribute prizes or handle end game logic
    }
}