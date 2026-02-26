const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("QuaiGameRewards", function () {
  async function deployFixture() {
    const [owner, operator, player, other] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("QuaiGameRewards");
    const contract = await Factory.deploy();
    await contract.waitForDeployment();
    return { contract, owner, operator, player, other };
  }

  it("completes 9 NPC talks in time and redeems 0.1 ether", async function () {
    const { contract, owner, operator, player } = await deployFixture();

    await contract.connect(owner).setGameOperator(operator.address, true);
    await contract.connect(player).startChallenge();

    for (let i = 0; i < 9; i += 1) {
      await contract.connect(operator).recordNpcTalk(player.address);
    }

    const progress = await contract.getPlayerProgress(player.address);
    expect(progress.npcTalks).to.equal(9n);
    expect(progress.rewardPoints).to.equal(3n);
    expect(progress.completed).to.equal(true);
    expect(progress.claimableUnits).to.equal(1n);

    await owner.sendTransaction({
      to: await contract.getAddress(),
      value: ethers.parseEther("0.1"),
    });

    const beforeContractBal = await ethers.provider.getBalance(await contract.getAddress());
    expect(beforeContractBal).to.equal(ethers.parseEther("0.1"));

    await contract.connect(player).redeemMyRewards();

    const afterContractBal = await ethers.provider.getBalance(await contract.getAddress());
    expect(afterContractBal).to.equal(0n);
    expect(await contract.pendingRewardUnits(player.address)).to.equal(0n);
  });

  it("blocks non-operators from recording NPC talks", async function () {
    const { contract, player, other } = await deployFixture();
    await contract.connect(player).startChallenge();

    await expect(contract.connect(other).recordNpcTalk(player.address)).to.be.revertedWith("Not operator");
  });

  it("resets expired challenge and rejects stale NPC updates", async function () {
    const { contract, owner, operator, player } = await deployFixture();

    await contract.connect(owner).setGameOperator(operator.address, true);
    await contract.connect(player).startChallenge();

    await ethers.provider.send("evm_increaseTime", [301]);
    await ethers.provider.send("evm_mine", []);

    await expect(contract.connect(operator).recordNpcTalk(player.address)).to.be.revertedWith("Challenge not active");

    const progress = await contract.getPlayerProgress(player.address);
    expect(progress.npcTalks).to.equal(0n);
    expect(progress.claimableUnits).to.equal(0n);
  });

  it("prevents starting a second active challenge", async function () {
    const { contract, player } = await deployFixture();
    await contract.connect(player).startChallenge();

    await expect(contract.connect(player).startChallenge()).to.be.revertedWith("Challenge already active");
  });
});
