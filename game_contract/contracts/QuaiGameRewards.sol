// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract QuaiGameRewards {

    address public owner;
    uint256 public rewardPerUnit = 0.1 ether;

    uint256 public constant CHALLENGE_WINDOW = 5 minutes;
    uint256 public constant NPCS_PER_POINT = 3;
    uint256 public constant NPCS_PER_CHALLENGE = 9;

    struct PlayerState {
        uint64 challengeStartedAt;
        uint8 npcTalks;
        bool completed;
    }

    mapping(address => PlayerState) public playerStates;
    mapping(address => uint256) public pendingRewardUnits;
    mapping(address => bool) public gameOperators;

    mapping(bytes32 => bool) public usedRewardIds;

    event RewardSent(
        address indexed player,
        uint256 units,
        uint256 totalAmount,
        bytes32 indexed rewardId
    );
    event ChallengeStarted(address indexed player, uint256 startedAt, uint256 endsAt);
    event NpcTalkRecorded(address indexed player, uint256 npcTalks, uint256 rewardPoints);
    event ChallengeCompleted(address indexed player, uint256 pendingUnits);
    event RewardRedeemed(address indexed player, uint256 units, uint256 amount);
    event GameOperatorUpdated(address indexed operator, bool allowed);
    event RewardPerUnitUpdated(uint256 oldValue, uint256 newValue);

    constructor() {
        owner = msg.sender;
        gameOperators[msg.sender] = true;
    }

    receive() external payable {}

    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized");
        _;
    }

    modifier onlyOperator() {
        require(gameOperators[msg.sender], "Not operator");
        _;
    }

    function setGameOperator(address operator, bool allowed) external onlyOwner {
        require(operator != address(0), "Invalid operator");
        gameOperators[operator] = allowed;
        emit GameOperatorUpdated(operator, allowed);
    }

    function setRewardPerUnit(uint256 newRewardPerUnit) external onlyOwner {
        require(newRewardPerUnit > 0, "Invalid reward value");
        uint256 oldValue = rewardPerUnit;
        rewardPerUnit = newRewardPerUnit;
        emit RewardPerUnitUpdated(oldValue, newRewardPerUnit);
    }

    function startChallenge() external {
        _startChallenge(msg.sender);
    }

    function startChallengeFor(address player) external onlyOperator {
        _startChallenge(player);
    }

    function recordNpcTalk(address player) external onlyOperator {
        require(player != address(0), "Invalid player address");

        PlayerState storage state = playerStates[player];

        if (_isExpired(state)) {
            _resetChallenge(state);
        }

        require(state.challengeStartedAt != 0, "Challenge not active");
        require(!state.completed, "Challenge already complete");
        require(state.npcTalks < NPCS_PER_CHALLENGE, "NPC limit reached");

        state.npcTalks += 1;
        uint256 rewardPoints = state.npcTalks / uint8(NPCS_PER_POINT);

        emit NpcTalkRecorded(player, state.npcTalks, rewardPoints);

        if (state.npcTalks == NPCS_PER_CHALLENGE) {
            state.completed = true;
            pendingRewardUnits[player] += 1;
            emit ChallengeCompleted(player, pendingRewardUnits[player]);
        }
    }

    function redeemMyRewards() external {
        uint256 units = pendingRewardUnits[msg.sender];
        require(units > 0, "No pending rewards");

        uint256 totalAmount = units * rewardPerUnit;
        require(address(this).balance >= totalAmount, "Insufficient balance");

        pendingRewardUnits[msg.sender] = 0;
        _resetChallenge(playerStates[msg.sender]);

        payable(msg.sender).transfer(totalAmount);

        emit RewardRedeemed(msg.sender, units, totalAmount);
    }

    function getPlayerProgress(address player)
        external
        view
        returns (
            uint256 challengeStartedAt,
            uint256 challengeEndsAt,
            uint256 npcTalks,
            uint256 rewardPoints,
            bool completed,
            bool expired,
            uint256 claimableUnits
        )
    {
        PlayerState memory state = playerStates[player];
        challengeStartedAt = state.challengeStartedAt;
        challengeEndsAt = challengeStartedAt == 0 ? 0 : challengeStartedAt + CHALLENGE_WINDOW;
        npcTalks = state.npcTalks;
        rewardPoints = npcTalks / NPCS_PER_POINT;
        completed = state.completed;
        expired = _isExpired(state);
        claimableUnits = pendingRewardUnits[player];
    }

    function rewardPlayer(
        address player,
        uint256 units,
        bytes32 rewardId
    ) external onlyOwner {
        require(player != address(0), "Invalid player address");
        require(units > 0, "Units must be greater than 0");
        require(!usedRewardIds[rewardId], "Already claimed");

        uint256 totalAmount = units * rewardPerUnit;
        require(address(this).balance >= totalAmount, "Insufficient balance");

        usedRewardIds[rewardId] = true;

        payable(player).transfer(totalAmount);

        emit RewardSent(player, units, totalAmount, rewardId);
    }

    function _startChallenge(address player) internal {
        require(player != address(0), "Invalid player address");

        PlayerState storage state = playerStates[player];

        if (state.challengeStartedAt != 0 && !_isExpired(state) && !state.completed) {
            revert("Challenge already active");
        }

        state.challengeStartedAt = uint64(block.timestamp);
        state.npcTalks = 0;
        state.completed = false;

        emit ChallengeStarted(player, block.timestamp, block.timestamp + CHALLENGE_WINDOW);
    }

    function _isExpired(PlayerState memory state) internal view returns (bool) {
        if (state.challengeStartedAt == 0 || state.completed) {
            return false;
        }
        return block.timestamp > uint256(state.challengeStartedAt) + CHALLENGE_WINDOW;
    }

    function _resetChallenge(PlayerState storage state) internal {
        state.challengeStartedAt = 0;
        state.npcTalks = 0;
        state.completed = false;
    }
}
