import '@nomiclabs/hardhat-waffle'
import '@typechain/hardhat'
import { HardhatUserConfig } from 'hardhat/config'
import 'hardhat-deploy'
import '@nomiclabs/hardhat-etherscan'
import '@nomiclabs/hardhat-ethers';
import '@openzeppelin/hardhat-upgrades';
import { HDNode } from "@ethersproject/hdnode";

import 'solidity-coverage'

import * as fs from 'fs'

import dotenv from "dotenv";
dotenv.config({ path: __dirname + '/.env' });

const mnemonicFileName = process.env.MNEMONIC_FILE ?? `${process.env.HOME}/.secret/testnet-mnemonic.txt`
let mnemonic = 'test '.repeat(11) + 'junk'
if (fs.existsSync(mnemonicFileName)) { mnemonic = fs.readFileSync(mnemonicFileName, 'ascii') }
const private_key = HDNode.fromMnemonic(mnemonic).privateKey;
function getNetwork1 (url: string): { url: string, accounts: { mnemonic: string } } {
  return {
    url,
    accounts: { mnemonic }
  }
}

function getNetwork (name: string): { url: string, accounts: { mnemonic: string } } {
  return getNetwork1(`https://${name}.infura.io/v3/${process.env.INFURA_ID}`)
  // return getNetwork1(`wss://${name}.infura.io/ws/v3/${process.env.INFURA_ID}`)
}

const optimizedComilerSettings = {
  version: '0.8.17',
  settings: {
    optimizer: { enabled: true, runs: 1000000 },
    viaIR: true
  }
}

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

const config: HardhatUserConfig = {
  solidity: {
    compilers: [{
      version: '0.8.15',
      settings: {
        optimizer: { enabled: true, runs: 1000000 }
      }
    }],
    overrides: {
      'contracts/core/EntryPoint.sol': optimizedComilerSettings,
      'contracts/samples/SimpleAccount.sol': optimizedComilerSettings
    }
  },

  networks: {
    dev: { url: 'http://localhost:8545' },
    // github action starts localgeth service, for gas calculations
    localgeth: { url: 'http://localgeth:8545' },
    goerli: getNetwork('goerli'),
    sepolia: getNetwork('sepolia'),
    proxy: getNetwork1('http://localhost:8545'),
    eco_mainnet: getNetwork1('https://api.elastos.io/eco'),
    hardhat: {
      chainId: 12343,
      accounts:   [{ privateKey: private_key, balance: '10000000000000000000000' }]
    },
  },
  // Ignore node_modules in the watcher
  watcher: {
    compile: {
      tasks: ["compile"],
      files: ["./contracts"],
      verbose: true,
    },
  },
  mocha: {
    timeout: 10000
  },

  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY || '',
      goerli: process.env.ETHERSCAN_API_KEY || '',
      sepolia: process.env.ETHERSCAN_API_KEY || '',
      eco_mainnet: 'empty',
    },
    customChains: [
      {
        network: 'eco_mainnet',
        chainId: 12343, // Elastos chain ID is 20, not 12343
        urls: {
          apiURL: "https://eco.elastos.io:443/api",
          browserURL: "https://eco.elastos.io:443"
        }
      }
      ]
  },

  namedAccounts: {
    deployer: {
      default: 0, // First account from mnemonic
    },
  },

}

// coverage chokes on the "compilers" settings
if (process.env.COVERAGE != null) {
  // @ts-ignore
  config.solidity = config.solidity.compilers[0]
}

export default config
