const { getSigner, getContract } = require("./_gameHelpers");

async function main() {
  const signer = await getSigner();
  const contract = await getContract(signer);
  const player = process.env.PLAYER_ADDRESS || signer.address;

  const progress = await contract.getPlayerProgress(player);
  const [
    challengeStartedAt,
    challengeEndsAt,
    npcTalks,
    rewardPoints,
    completed,
    expired,
    claimableUnits,
  ] = progress;

  console.log(`player=${player}`);
  console.log(`challengeStartedAt=${challengeStartedAt}`);
  console.log(`challengeEndsAt=${challengeEndsAt}`);
  console.log(`npcTalks=${npcTalks}`);
  console.log(`rewardPoints=${rewardPoints}`);
  console.log(`completed=${completed}`);
  console.log(`expired=${expired}`);
  console.log(`claimableUnits=${claimableUnits}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
