// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.12;

/* solhint-disable reason-string */

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../core/BasePaymaster.sol";
import {IAssetOracle} from "./IAssetOracle.sol";

/**
 * A sample paymaster that defines itself as a token to pay for gas.
 * The paymaster IS the token to use, since a paymaster cannot use an external contract.
 * Also, the exchange rate has to be fixed, since it can't reference an external Uniswap or other exchange contract.
 * subclass should override "getTokenValueOfEth" to provide actual token exchange rate, settable by the owner.
 * Known Limitation: this paymaster is exploitable when put into a batch with multiple ops (of different accounts):
 * - while a single op can't exploit the paymaster (if postOp fails to withdraw the tokens, the user's op is reverted,
 *   and then we know we can withdraw the tokens), multiple ops with different senders (all using this paymaster)
 *   in a batch can withdraw funds from 2nd and further ops, forcing the paymaster itself to pay (from its deposit)
 * - Possible workarounds are either use a more complex paymaster scheme (e.g. the DepositPaymaster) or
 *   to whitelist the account and the called method ids.
 */
contract PGAPaymaster is BasePaymaster, ERC20 {

    //calculated cost of the postOp
    uint256 constant public COST_OF_POST = 15000 + 25000;
    uint256 constant public MAX_ETH_PER_TOKEN_RATE = 10000;
    uint256 public ethPerTokenRate;
    address public theFactory;
    address public operator;

    event SetEthPerTokenRate(uint256 ethPerTokenRate);
    event SetTheFactory(address newFactory);
    event SetOperator(address newOperator);

    constructor(
        address accountFactory,
        string memory _symbol,
        IEntryPoint _entryPoint,
        address mintTo
    ) ERC20(_symbol, _symbol) BasePaymaster(_entryPoint) {
        require(
            accountFactory != address (0) &&
            address(_entryPoint) != address(0) &&
            address(mintTo) != address(0)
            , "address cannot be zero"
        );
        theFactory = accountFactory;
        //make it non-empty
        uint256 totalSupply = 200000000 * 1e18;
        _mint(mintTo, totalSupply);

        //owner is allowed to withdraw tokens from the paymaster's balance
        operator = msg.sender;
        _approve(address(this), msg.sender, type(uint).max);
        ethPerTokenRate = MAX_ETH_PER_TOKEN_RATE;
    }

    function setOperator(address newOperator) external onlyOwner {
        // remove allowance of current owner
        _approve(address(this), operator, 0);
        operator = newOperator;
        // new owner is allowed to withdraw tokens from the paymaster's balance
        _approve(address(this), newOperator, type(uint).max);
        emit SetOperator(newOperator);
    }

    modifier onlyOperator() {
        _checkOperator();
        _;
    }

    function _checkOperator() internal view virtual {
        require(operator == _msgSender(), "PayMaster: caller is not the operator");
    }

    /**
     * transfer paymaster ownership.
     * owner of this paymaster is allowed to withdraw funds (tokens transferred to this paymaster's balance)
     * when changing owner, the old owner's withdrawal rights are revoked.
     */
    function transferOwnership(address newOwner) public override virtual onlyOwner {
        super.transferOwnership(newOwner);
    }

    //Note: this method assumes a fixed ratio of token-to-eth. subclass should override to supply oracle
    // or a setter.
    function getTokenValueOfEth(uint256 valueEth) internal view virtual returns (uint256 valueToken) {
        return valueEth * ethPerTokenRate / MAX_ETH_PER_TOKEN_RATE;
    }

    function setEthPerTokenRate(uint256 _ethPerTokenRate) external onlyOperator {
        ethPerTokenRate = _ethPerTokenRate;
        emit SetEthPerTokenRate(_ethPerTokenRate);
    }


/**
  * validate the request:
  * if this is a constructor call, make sure it is a known account.
  * verify the sender has enough tokens.
  * (since the paymaster is also the token, there is no notion of "approval")
  */
    function _validatePaymasterUserOp(UserOperation calldata userOp, bytes32 /*userOpHash*/, uint256 requiredPreFund)
    internal view override returns (bytes memory context, uint256 validationData) {
        uint256 tokenPrefund = getTokenValueOfEth(requiredPreFund);

        // verificationGasLimit is dual-purposed, as gas limit for postOp. make sure it is high enough
        // make sure that verificationGasLimit is high enough to handle postOp
        require(userOp.verificationGasLimit > COST_OF_POST, "TokenPaymaster: gas too low for postOp");

        if (userOp.initCode.length != 0) {
            _validateConstructor(userOp);
            require(balanceOf(userOp.sender) >= tokenPrefund, "TokenPaymaster: no balance (pre-create)");
        } else {

            require(balanceOf(userOp.sender) >= tokenPrefund, "TokenPaymaster: no balance");
        }

        return (abi.encode(userOp.sender), 0);
    }

    // when constructing an account, validate constructor code and parameters
    // we trust our factory (and that it doesn't have any other public methods)
    function _validateConstructor(UserOperation calldata userOp) internal virtual view {
        address factory = address(bytes20(userOp.initCode[0 : 20]));
        require(factory == theFactory, "TokenPaymaster: wrong account factory");
    }

    /**
     * actual charge of user.
     * this method will be called just after the user's TX with mode==OpSucceeded|OpReverted (account pays in both cases)
     * BUT: if the user changed its balance in a way that will cause  postOp to revert, then it gets called again, after reverting
     * the user's TX , back to the state it was before the transaction started (before the validatePaymasterUserOp),
     * and the transaction should succeed there.
     */
    function _postOp(PostOpMode mode, bytes calldata context, uint256 actualGasCost) internal override {
        //we don't really care about the mode, we just pay the gas with the user's tokens.
        (mode);
        address sender = abi.decode(context, (address));
        uint256 charge = getTokenValueOfEth(actualGasCost + COST_OF_POST);
        //actualGasCost is known to be no larger than the above requiredPreFund, so the transfer should succeed.
        _transfer(sender, address(this), charge);
    }

    /**
    * @notice Updates the factory contract address
     * @param newFactory The address of the new factory contract
     */
    function setTheFactory(address newFactory) external onlyOwner {
        require(newFactory != address(0), "Factory cannot be zero address");
        theFactory = newFactory;
        emit SetTheFactory(newFactory);
    }

    /**
     * withdraw value from the deposit
     * @param withdrawAddress target to send to
     * @param amount to withdraw
     */
    function withdrawTo(address payable withdrawAddress, uint256 amount) public onlyOperator {
        entryPoint.withdrawTo(withdrawAddress, amount);
    }

    /**
     * add stake for this paymaster.
     * This method can also carry eth value to add to the current stake.
     * @param unstakeDelaySec - the unstake delay for this paymaster. Can only be increased.
     */
    function addStake(uint32 unstakeDelaySec) external payable onlyOperator {
        entryPoint.addStake{value : msg.value}(unstakeDelaySec);
    }

    /**
     * withdraw the entire paymaster's stake.
     * stake must be unlocked first (and then wait for the unstakeDelay to be over)
     * @param withdrawAddress the address to send withdrawn value.
     */
    function withdrawStake(address payable withdrawAddress) external onlyOperator {
        entryPoint.withdrawStake(withdrawAddress);
    }

    /**
    * unlock the stake, in order to withdraw it.
    * The paymaster can't serve requests once unlocked, until it calls addStake again
    */
    function unlockStake() external onlyOperator {
        entryPoint.unlockStake();
    }

    function withdrawPGA(address to, uint256 amount) external onlyOperator {
        transferFrom(address(this), to, amount);
    }
}
