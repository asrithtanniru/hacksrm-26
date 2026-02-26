const { getRequiredEnv, getSigner, getContract } = require("./_gameHelpers");

async function main() {
  const signer = await getSigner();
  const contract = await getContract(signer);
  const player = getRequiredEnv("PLAYER_ADDRESS");
  const count = Number(process.env.COUNT || "1");

  if (!Number.isInteger(count) || count <= 0) {
    throw new Error("COUNT must be a positive integer");
  }

  for (let i = 1; i <= count; i += 1) {
    const tx = await contract.recordNpcTalk(player);
    await tx.wait();
    console.log(`recordNpcTalk ${i}/${count} tx: ${tx.hash}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
