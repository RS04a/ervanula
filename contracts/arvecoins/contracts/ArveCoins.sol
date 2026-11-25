// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {TRC20} from "@openzeppelin/tron-contracts/token/TRC20/TRC20.sol";

contract ArveCoins is TRC20 {
    constructor() TRC20("ArveCoins", "ARVE") {
        _mint(msg.sender, 1_000_000 * 10 ** 6);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }
}
