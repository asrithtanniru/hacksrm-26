const { getSigner, getContract } = require("./_gameHelpers");

async function main() {
  const signer = await getSigner();
  const contract = await getContract(signer);

  const tx = await contract.startChallenge();
  await tx.wait();

  console.log(`startChallenge tx: ${tx.hash}`);
  console.log(`player=${signer.address}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
