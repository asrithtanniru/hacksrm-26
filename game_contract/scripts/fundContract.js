const hre = require("hardhat");
const { getSigner, getContract } = require("./_gameHelpers");

async function main() {
  const signer = await getSigner();
  const contract = await getContract(signer);
  const amount = process.env.AMOUNT || "0.1";

  const tx = await signer.sendTransaction({
    to: await contract.getAddress(),
    value: hre.ethers.parseEther(amount),
  });
  await tx.wait();

  console.log(`fund tx: ${tx.hash}`);
  console.log(`amount=${amount} QUAI`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
