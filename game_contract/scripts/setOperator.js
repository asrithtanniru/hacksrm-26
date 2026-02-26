const { getRequiredEnv, getSigner, getContract, toBool } = require("./_gameHelpers");

async function main() {
  const signer = await getSigner();
  const contract = await getContract(signer);
  const operator = getRequiredEnv("OPERATOR_ADDRESS");
  const allowed = toBool(process.env.ALLOWED, true);

  const tx = await contract.setGameOperator(operator, allowed);
  await tx.wait();

  console.log(`setGameOperator tx: ${tx.hash}`);
  console.log(`operator=${operator} allowed=${allowed}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
