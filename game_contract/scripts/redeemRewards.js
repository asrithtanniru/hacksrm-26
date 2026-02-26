const { getSigner, getContract } = require("./_gameHelpers");

async function main() {
  const signer = await getSigner();
  const contract = await getContract(signer);

  const tx = await contract.redeemMyRewards();
  await tx.wait();

  console.log(`redeemMyRewards tx: ${tx.hash}`);
  console.log(`player=${signer.address}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
