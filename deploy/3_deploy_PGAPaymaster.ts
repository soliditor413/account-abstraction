import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { ethers } from 'hardhat'

const deployPGAPaymaster: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const provider = ethers.provider
  const from = await provider.getSigner().getAddress()
  const network = await provider.getNetwork()

  console.log('Deploying PGAPaymaster.sol on network:', network.name)
  console.log('Deployer address:', from)

  // Get the EntryPoint address from deployments
  const entryPoint = await hre.deployments.get('EntryPoint')

  // These addresses should be replaced with actual values
  const accountFactory = await hre.deployments.get('SimpleAccountFactory') // Replace with your account factory address
  const oracleAddress = '0x04dc48be6D231910b68612f61B5dF73915b55994';
  const mintTo = from;
  if (accountFactory === '0x...') {
    throw new Error('Please set the accountFactory in the deployment script')
  }

  console.log('Using EntryPoint:', entryPoint.address)
  console.log('Using Account Factory:', accountFactory.address)
  console.log('Using oracleAddress:', oracleAddress)

  // Deploy PGAPaymaster.sol
  const ret = await hre.deployments.deploy(
    'PGAPaymaster', {
      from,
      args: [
        accountFactory.address,
        "PGAF",
        entryPoint.address,
        oracleAddress,
        mintTo
      ],
      gasLimit: 6e6,
      log: true,
      deterministicDeployment: false
    })

  console.log('PGAPaymaster.sol deployed at:', ret.address)
  // Verify on block explorer
  if (network.name !== 'hardhat' && network.name !== 'localhost') {
    console.log('Waiting for block confirmations...')
    console.log('Verifying PGAPaymaster.sol on block explorer...')
    await hre.run('verify:verify', {
      address: ret.address,
      constructorArguments: [
        accountFactory.address,
        "PGAF",
        entryPoint.address,
        oracleAddress,
        mintTo
      ]
    })
  }
}

deployPGAPaymaster.tags = ['PGAPaymaster']

export default deployPGAPaymaster
