import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { Contract, Signer, constants } from 'ethers';
import {parseEther, keccak256} from "ethers/lib/utils";

import {
  EntryPoint,
  EntryPoint__factory,
  IERC20,
  IEntryPoint,
  SimpleAccount,
  SimpleAccountFactory__factory,
  SimpleAccount__factory, SimpleAccountFactory, TestAggregatedAccountFactory
} from '../typechain-types'

import {
  AddressZero,
  createAccountOwner,
  fund,
  getBalance,
  getTokenBalance,
  rethrow,
  checkForGeth,
  calcGasUsage,
  deployEntryPoint,
  checkForBannedOps,
  createAddress,
  ONE_ETH,
  createAccount,
  getAccountAddress
} from './testutils'
import fs from "fs";
import {HDNode} from "@ethersproject/hdnode";

describe('PGAPaymaster', function () {
  let entryPoint: EntryPoint;
  let owner: Signer;
  let pgaToken: Contract;
  let paymaster: Contract;
  let aaAccount: Contract;


  const mnemonicFileName = process.env.MNEMONIC_FILE ?? `${process.env.HOME}/.secret/testnet-mnemonic.txt`
  let mnemonic = 'test '.repeat(11) + 'junk'
  if (fs.existsSync(mnemonicFileName)) { mnemonic = fs.readFileSync(mnemonicFileName, 'ascii') }
  const private_key = HDNode.fromMnemonic(mnemonic).privateKey;

  before(async function () {
    // Get signers
    const signers = await ethers.getSigners();
    owner = signers[0];
    console.log("owner", await owner.getAddress(), "balance ", await owner.getBalance());

    entryPoint = await deployEntryPoint();
    console.log("entryPoint deployed at", entryPoint.address);

    // Deploy PGAToken
    const PGAToken = await ethers.getContractFactory('PGAToken', owner);
    pgaToken = await PGAToken.deploy();
    await pgaToken.deployed();
    console.log("pgaToken deployed at", pgaToken.address);


    // Deploy PGAPaymaster
    const PGAPaymaster = await ethers.getContractFactory('PGAPaymaster');

    paymaster = await PGAPaymaster.deploy(entryPoint.address, pgaToken.address, entryPoint.address, entryPoint.address);

    await paymaster.deployed();
    console.log("paymaster deployed at", paymaster.address);

    ({proxy: aaAccount} = await createAccount(owner, await owner.getAddress(), entryPoint.address));
    console.log("aaAccount ", aaAccount.address)

    pgaToken.transfer(aaAccount.address, ethers.utils.parseEther("1.0"));
  });

  it("test UserOperation", async () => {
    const wallet = new ethers.Wallet(private_key);
    const signer = await wallet.getAddress();
     const signature = await getSignature(private_key, pgaToken, paymaster.address);
    console.log("signature ", signature);
      const sig = await paymaster.splitSignature(signature);
      console.log("v:", sig[0]);
      console.log("r:", sig[1]);
      console.log("s:", sig[2]);
      const value = ethers.utils.parseEther('1.0')
      const amount = ethers.utils.hexZeroPad(ethers.utils.hexlify(value), 32)
     // Encode paymasterAndData in the format expected by the contract:
     // 20 bytes: token address
     // 32 bytes: amount
     // variable: signature bytes
     const paymasterAndData = ethers.utils.hexConcat([
       pgaToken.address,
       amount,
       signature
     ]);
     console.log("paymasterAndData ", paymasterAndData);
     let userOp = {
       sender: signer,
       nonce:  aaAccount.getNonce(),
       initCode: "0x",
       callData: "0x",
       callGasLimit: 0,
       verificationGasLimit: 0,
       preVerificationGas: 0,
       maxFeePerGas: 0,
       maxPriorityFeePerGas: 0,
       paymasterAndData: paymasterAndData,
       signature: "0x"
     }

     // const result = await paymaster.validateUserOp(userOp);
     // const receipt = await result.wait();
     // console.log("validateUserOp result", receipt.status);

    //  const postTx = await paymaster.testPostOp(userOp.sender, value);
    //  const postReceipt = await postTx.wait();
    // console.log("postReceipt result", postReceipt.status);
  })

});

async function getSignature(private_key:string, pgaToken:Contract, paymasterAddress: string ) {
  const wallet = new ethers.Wallet(private_key);
    const ownerAddress = await wallet.getAddress();
    console.log("wallet address", ownerAddress);

    // Get the current nonce for the token
    const nonce = await pgaToken.nonces(ownerAddress);

    // Set up the domain separator data for EIP-712
    const domain = {
      name: await pgaToken.name(),
      version: '1',
      chainId: (await ethers.provider.getNetwork()).chainId,
      verifyingContract: pgaToken.address
    };

    // The named list of all type definitions
    const types = {
      Permit: [
        { name: 'owner', type: 'address' },
        { name: 'spender', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
      ]
    };

    // The data to sign
    const value = {
      owner: ownerAddress,
      spender: paymasterAddress,  // The paymaster is the spender
      value: ethers.utils.parseEther('1.0'),  // Amount to approve
      nonce: nonce,
      deadline: ethers.constants.MaxUint256
    };
    // Sign the typed data
    return await wallet._signTypedData(domain, types, value);
}
