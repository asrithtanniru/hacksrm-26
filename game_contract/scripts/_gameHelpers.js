const hre = require("hardhat");
require("dotenv").config();

function toBool(value, defaultValue) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value.trim();
}

function normalizePk(privateKey) {
  return privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;
}

async function getSigner() {
  if (process.env.SIGNER_PK && process.env.SIGNER_PK.trim().length > 0) {
    return new hre.ethers.Wallet(normalizePk(process.env.SIGNER_PK.trim()), hre.ethers.provider);
  }
  const [defaultSigner] = await hre.ethers.getSigners();
  return defaultSigner;
}

async function getContract(signer) {
  const contractAddress = getRequiredEnv("CONTRACT_ADDRESS");
  return hre.ethers.getContractAt("QuaiGameRewards", contractAddress, signer);
}

module.exports = {
  toBool,
  getRequiredEnv,
  getSigner,
  getContract,
};
