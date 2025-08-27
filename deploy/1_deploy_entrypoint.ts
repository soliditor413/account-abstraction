import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { Create2Factory } from '../src/Create2Factory'
import { ethers } from 'hardhat'

const deployEntryPoint: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const provider = ethers.provider
    const network = await provider.getNetwork()
    const from = await provider.getSigner().getAddress()
    console.log("from=", from)
  // await new Create2Factory(ethers.provider).deployFactory()

  const ret = await hre.deployments.deploy(
    'EntryPoint', {
      from,
      args: [],
      gasLimit: 6e6,
      deterministicDeployment: false
    })
  console.log('==entrypoint addr=', ret.address)

    if (network.name !== 'hardhat' && network.name !== 'localhost') {
        console.log('Waiting for block confirmations...')
        console.log('Verifying  on block explorer...')
        await hre.run('verify:verify', {
            address: ret.address,
            constructorArguments: [
            ]
        })
    }

/*
  const entryPointAddress = ret.address
  const w = await hre.deployments.deploy(
    'SimpleAccount', {
      from,
      args: [entryPointAddress, from],
      gasLimit: 2e6,
      deterministicDeployment: false
    })

  console.log('== wallet=', w.address)

  const t = await hre.deployments.deploy('TestCounter', {
    from,
    deterministicDeployment: true
  })
  console.log('==testCounter=', t.address)
  */
}
export default deployEntryPoint
