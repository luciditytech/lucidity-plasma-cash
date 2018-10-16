pragma solidity ^0.4.17;

import "truffle/Assert.sol";
import "truffle/DeployedAddresses.sol";
import "../contracts/PlasmaCash.sol";

contract TestPlasma {

    PlasmaCash plasma = new PlasmaCash(60);

    function testSetOperator() public {
        Assert.equal(plasma.setOperator(this, true), true, "Set an operator.");
    }

    function testOwnerIsOperator() public {
        Assert.equal(plasma.operators(this), true, "Owner is an operator.");
    }
}