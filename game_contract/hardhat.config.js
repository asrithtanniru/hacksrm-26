/**
 * @type import('hardhat/config').HardhatUserConfig
 */

require('@nomicfoundation/hardhat-toolbox')
require("@quai/hardhat-deploy-metadata");

const dotenv = require('dotenv')
dotenv.config({ path: './.env' })

module.exports = {
  defaultNetwork: 'hardhat',
  networks: {
    cyprus1: {
      url: process.env.RPC_URL,
      accounts: process.env.CYPRUS1_PK ? [process.env.CYPRUS1_PK] : [],
      chainId: Number(process.env.CHAIN_ID),
    },
  },

  solidity: {
    compilers: [
      {
      version: '0.8.20',
      settings: {
        optimizer: {
          enabled: true,
          runs: 1000,
        },
        metadata: {
          bytecodeHash: 'ipfs',
          useLiteralContent: true, // Include the source code in the metadata
        },
        evmVersion: 'london',
      },
    },
    {
      version: '0.8.20',
      settings: {
        optimizer: {
          enabled: true,
          runs: 1000,
        },
        metadata: {
          bytecodeHash: 'ipfs',
          useLiteralContent: true, // Include the source code in the metadata
        },
        evmVersion: 'london',
      },
    },
  ]
  },

  // etherscan: {
  //   apiKey: {
  //     cyprus1: 'abc',
  //   },
  //   customChains: [
  //     {
  //       network: 'cyprus1',
  //       chainId: Number(process.env.CHAINID),
  //       urls: {
  //         apiURL: 'https://quaiscan.io/api/v2',
  //         browserURL: 'https://quaiscan.io/',
  //       },
  //     },
  //   ],
  // },

  paths: {
    sources: './contracts',
    cache: './cache',
    artifacts: './artifacts',
  },
  mocha: {
    timeout: 20000,
  },
}
