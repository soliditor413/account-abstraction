import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { ethers } from 'hardhat'

const deploySimpleAccountFactory: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const provider = ethers.provider
  const from = await provider.getSigner().getAddress()
  const network = await provider.getNetwork()
  // only deploy on local test network.
    console.log('network.chainId=', network.chainId)
  if (network.chainId !== 12343 && network.chainId !== 1337) {
    return
  }

  const entrypoint = await hre.deployments.get('EntryPoint')
  const ret = await hre.deployments.deploy(
    'SimpleAccountFactory', {
      from,
      args: [entrypoint.address],
      gasLimit: 6e6,
      log: true,
      deterministicDeployment: false
    })
  console.log('==SimpleAccountFactory addr=', ret.address)

    // if (network.name !== 'hardhat' && network.name !== 'localhost') {
    //     console.log('Waiting for block confirmations...')
    //     console.log('Verifying  on block explorer...')
    //     await hre.run('verify:verify', {
    //         address: ret.address,
    //         constructorArguments: [
    //             entrypoint.address
    //         ]
    //     })
    // }
}

export default deploySimpleAccountFactory
