// @ts-ignore
import { network, ethers, getChainId } from 'hardhat'
import { wrapProvider, SimpleAccountAPI} from '@account-abstraction/sdk'

async function main() {
    // Get the signer
    const [signer] = await ethers.getSigners();

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
