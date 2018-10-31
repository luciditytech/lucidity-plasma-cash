pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

contract Operable is Ownable {

  mapping(address => bool) public operators;

  event LogSetOperator(address executor, address operator, bool status);

  modifier onlyOperator() {
    require(operators[msg.sender], "you are not the operator");
    _;
  }

  function setOperator(address _operator, bool _status)
  public
  onlyOwner
  returns (bool) {
    operators[_operator] = _status;
    emit LogSetOperator(msg.sender, _operator, _status);
    return true;
  }

}
