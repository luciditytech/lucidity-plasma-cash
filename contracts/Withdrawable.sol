pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";

import "./lib/RLP.sol";

contract Withdrawable {

  using SafeMath for uint256;

  mapping(address => uint256) public balances;

  event LogWithdraw(address indexed executor, uint256 amount);
  event LogAddBalance(address indexed receiver, uint256 amount);

  function withdraw() public {
    uint256 amount = balances[msg.sender];
    require(amount > 0, "your balance is 0");

    balances[msg.sender] = 0;
    msg.sender.transfer(amount);

    emit LogWithdraw(msg.sender, amount);
  }

  function addBalance(address _receiver, uint256 _amount)
  internal {
    require(_amount > 0, "_amount need to be positive value");
    require(_receiver != address(0), "_receiver can't be empty");

    balances[_receiver] = balances[_receiver].add(_amount);
    emit LogAddBalance(_receiver, _amount);
  }

}
