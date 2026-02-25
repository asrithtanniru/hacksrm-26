// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IQuaiToken {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @title CarCollectiblesNoOZ
/// @notice Dependency-free collectible contract.
/// Two car collectibles can be exchanged with Quai ERC20 tokens:
/// - Car 1 costs 3 Quai
/// - Car 2 costs 5 Quai
contract CarCollectiblesNoOZ {
    IQuaiToken public immutable quaiToken;
    address public owner;
    address public treasury;

    uint256 public constant CAR_ONE = 1;
    uint256 public constant CAR_TWO = 2;

    // Prices are in the smallest unit of Quai token (typically 18 decimals).
    uint256 public constant CAR_ONE_PRICE = 3 ether;
    uint256 public constant CAR_TWO_PRICE = 5 ether;

    // user => carId => quantity owned
    mapping(address => mapping(uint256 => uint256)) private _balances;

    event CarExchanged(address indexed buyer, uint256 indexed carId, uint256 amount, uint256 totalCost);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event OwnershipTransferred(address indexed oldOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor(
        address quaiTokenAddress,
        address treasuryAddress
    ) {
        require(quaiTokenAddress != address(0), "Invalid Quai token address");
        require(treasuryAddress != address(0), "Invalid treasury address");

        quaiToken = IQuaiToken(quaiTokenAddress);
        owner = msg.sender;
        treasury = treasuryAddress;
    }

    /// @notice Exchange Quai tokens for car collectibles.
    /// @param carId CAR_ONE (1) or CAR_TWO (2).
    /// @param amount Number of collectibles to mint.
    function exchangeForCar(uint256 carId, uint256 amount) external {
        require(amount > 0, "Amount must be greater than zero");
        uint256 unitPrice = _priceForCar(carId);
        uint256 totalCost = unitPrice * amount;

        bool ok = quaiToken.transferFrom(msg.sender, treasury, totalCost);
        require(ok, "Quai transfer failed");

        _balances[msg.sender][carId] += amount;
        emit CarExchanged(msg.sender, carId, amount, totalCost);
    }

    /// @notice Returns how many units of a car collectible a user owns.
    function balanceOf(address account, uint256 carId) external view returns (uint256) {
        require(account != address(0), "Invalid account");
        require(carId == CAR_ONE || carId == CAR_TWO, "Invalid car id");
        return _balances[account][carId];
    }

    /// @notice Update treasury address where Quai payments are sent.
    function setTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "Invalid treasury address");
        address oldTreasury = treasury;
        treasury = newTreasury;
        emit TreasuryUpdated(oldTreasury, newTreasury);
    }

    /// @notice Transfer contract ownership.
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid new owner");
        address oldOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }

    /// @notice Price lookup for frontends and integrations.
    function priceOf(uint256 carId) external pure returns (uint256) {
        return _priceForCar(carId);
    }

    function _priceForCar(uint256 carId) internal pure returns (uint256) {
        if (carId == CAR_ONE) {
            return CAR_ONE_PRICE;
        }
        if (carId == CAR_TWO) {
            return CAR_TWO_PRICE;
        }
        revert("Invalid car id");
    }
}
