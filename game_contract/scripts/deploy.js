const quais = require('quais')
const QuaiGameRewardsJson = require('../artifacts/contracts/QuaiGameRewards.sol/QuaiGameRewards.json')
const { deployMetadata } = require("hardhat");
require('dotenv').config()

// Pull contract arguments from .env
//const tokenArgs = [process.env.ERC20_NAME, process.env.ERC20_SYMBOL, quais.parseUnits(process.env.ERC20_INITIALSUPPLY)]

function getNormalizedPrivateKey() {
  const candidate = (process.env.CYPRUS1_PK || hre.network?.config?.accounts?.[0] || '').trim()
  if (!candidate) {
    throw new Error('Missing private key. Set CYPRUS1_PK in .env')
  }

  const withoutPrefix = candidate.startsWith('0x') ? candidate.slice(2) : candidate
  if (!/^[0-9a-fA-F]{64}$/.test(withoutPrefix)) {
    throw new Error(
      `Invalid private key format. Expected 64 hex chars (32 bytes), got length=${withoutPrefix.length}`
    )
  }
  return `0x${withoutPrefix}`
}

async function deployQuaiGameRewards() {
  const networkName = hre.network.name
  const rpcUrl = hre.network?.config?.url
  if (!rpcUrl) {
    throw new Error(
      `No RPC URL configured for network "${networkName}". ` +
      `Use --network cyprus1 (or set a URL for this network).`
    )
  }

  // Config provider, wallet, and contract factory
  const provider = new quais.JsonRpcProvider(rpcUrl, undefined, { usePathing: true })
  const privateKey = getNormalizedPrivateKey()
  const wallet = new quais.Wallet(privateKey, provider)
  console.log(`Using network: ${networkName}`)
  console.log(`Using wallet: ${wallet.address}`)

  const ipfsHash = await deployMetadata.pushMetadataToIPFS("QuaiGameRewards")
  const QuaiGameRewards = new quais.ContractFactory(QuaiGameRewardsJson.abi, QuaiGameRewardsJson.bytecode, wallet, ipfsHash)

  // Broadcast deploy transaction
  const QuaiGameRewards_transaction = await QuaiGameRewards.deploy()
  console.log('Transaction broadcasted: ', QuaiGameRewards_transaction.deploymentTransaction().hash)

  // Wait for contract to be deployed
  await QuaiGameRewards_transaction.waitForDeployment()
  console.log('Contract deployed to: ', await QuaiGameRewards_transaction.getAddress())
}

deployQuaiGameRewards()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
