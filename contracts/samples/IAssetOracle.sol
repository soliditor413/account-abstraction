// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.12;

interface IAssetOracle {
    function assetPrices(address asset) external view returns(uint256);
    function wrappedNativeToken() external view returns(address);
}
