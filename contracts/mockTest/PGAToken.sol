// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.10;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "hardhat/console.sol";

contract PGAToken is ERC20Permit {
    constructor()
    ERC20("TestPGA", "TestPGA")
    ERC20Permit("TestPGA") {
        _mint(msg.sender, 200000000 * 1e18);
    }
}
