pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/math/Math.sol";
import "./lib/MerkleProof.sol";
import "./lib/PriorityQueue.sol";
import "./Transaction.sol";

import "./lib/RLP.sol";

contract Plasma is Ownable {
  mapping(address => bool) public operators;

  modifier onlyOperator() {
    if (operators[msg.sender]) _;
  }

  function setOperator(address _op, bool _status) public onlyOwner returns (bool success) {
    operators[_op] = _status;
    return true;
  }

  function isOperator() public view returns (bool success) {
    return operators[msg.sender];
  }

  // blocks
  struct Block {
    bytes32 merkleRoot;
    uint256 timestamp;
  }

  uint public blockCount;
  mapping(uint => Block) public blocks;

  event BlockSubmitted(uint indexed blockIndex, address operator, bytes32 indexed merkleRoot);

  function submitBlock(bytes32 _merkleRoot, uint _blockIndex) public onlyOperator {
    require(blockCount == _blockIndex, "blockCount == _blockIndex");

    Block memory newBlock = Block(_merkleRoot, block.timestamp);

    blocks[_blockIndex] = newBlock;

    emit BlockSubmitted(_blockIndex, msg.sender, _merkleRoot);

    blockCount += 1;
  }

  // deposits
  struct Deposit {
    address depositor;
    uint amount;
  }

  mapping(uint => Deposit) public deposits;
  uint public depositCount;

  event Deposited(uint indexed uid, address depositor, uint amount);

  function deposit(address _currency, uint _amount) public payable {
    require(_amount > 0, "_amount > 0");

    if (_currency == address(0)) {
      require(_amount == msg.value, "_amount == msg.value");
    } else {
      revert("_currency != address(0)");
    }

    uint uid = depositCount;
    deposits[uid] = Deposit(msg.sender, _amount);

    emit Deposited(uid, msg.sender, _amount);

    depositCount += 1;
  }

  // withdrawals
  struct ExitTX {
    address exitor;
    uint timestamp;
  }

  uint challengeTimeout;

  PriorityQueue exitsQueue;
  mapping(uint => ExitTX) public exits;

  event WithdrawDeposit(address depositor, uint indexed uid, uint256 indexed timestamp, uint amount);
  event ExitStarted(uint indexed priority);

  function withdrawDeposit(uint _uid) public {
    // check if the deposit exists and the owner matches
    require(deposits[_uid].depositor == msg.sender, "deposits[_uid].depositor == msg.sender");

    ExitTX memory exitTX = ExitTX(msg.sender, block.timestamp + challengeTimeout);
    addExitToQueue(_uid, exitTX);

    emit WithdrawDeposit(msg.sender, _uid, block.timestamp, deposits[_uid].amount);
  }

  function addExitToQueue(uint _uid, ExitTX memory exitTX) private {
    // check if correspondent withdrawal has been already requested
    require(exits[_uid].timestamp == 0, "exits[_uid].timestamp == 0");

    uint priority = exitTX.timestamp << 128 | _uid;
    exitsQueue.insert(priority);
    exits[_uid] = exitTX;

    emit ExitStarted(priority);
  }

  function getNextExit() public view returns (uint uid, uint timestamp) {
    uint256 priority = exitsQueue.getMin();
    uid = uint256(uint128(priority));
    timestamp = priority >> 128;
  }

  event FinalizedExit(address depositor, uint amount, uint indexed uid, uint256 indexed timestamp);

  function finalizeExits() public returns (uint processed) {
    uint uid;
    uint exitTimestamp;

    uint timestamp = block.timestamp;

    (uid, exitTimestamp) = getNextExit();
    while (exitTimestamp < timestamp) {
      ExitTX memory exitTX = exits[uid];

      if (exitTX.exitor != 0x0) {
        // nobody has challenged the exit
        uint amount = deposits[uid].amount;
        exitTX.exitor.transfer(amount);

        emit FinalizedExit(exitTX.exitor, amount, uid, timestamp);

        delete exits[uid];
        delete deposits[uid];
      }

      exitsQueue.delMin();
      processed += 1;

      if (exitsQueue.currentSize() > 0) {
        (uid, exitTimestamp) = getNextExit();
      } else {
        return;
      }
    }
  }

  event DepositWithdrawChallenged(address challenger, address depositor, uint indexed uid, uint blockIndex);

  // challenge
  function challengeWithdrawDeposit(uint _blockIndex, bytes _transactionBytes, bytes _proof, bytes signature) public returns (bool success) {
    Block memory plasmaBlock = blocks[_blockIndex];
    Transaction.TX memory transaction = Transaction.createTransaction(_transactionBytes);

    require(deposits[transaction.uid].amount > 0, "deposits[transaction.uid].amount > 0"); // check if the deposit exists

    //require(exits[transaction.uid].timestamp >= block.timestamp); // check if challenge timeout is off

    bytes32 hash = Transaction.hashTransaction(transaction);

    // check is TX exists
    require(MerkleProof.verifyProof(_proof, plasmaBlock.merkleRoot, hash, transaction.uid), "MerkleProof.verifyProof(...)");

    address exitor = exits[transaction.uid].exitor;

    // check if the correspondent signature correct
    require(Transaction.checkSig(exitor, hash, signature), "Transaction.checkSig(exitor, hash, signature)");

    require(exitor != transaction.newOwner, "exitor != transaction.newOwner"); // check if the owner has been changed

    delete exits[transaction.uid]; // delete exit
    // TODO: prevent further challengeWithdrawDeposit calls with the same UID

    emit DepositWithdrawChallenged(msg.sender, exitor, transaction.uid, _blockIndex);

    return true;
  }

  // temp methods
  function verifyProof(bytes _proof, bytes32 _root, bytes32 _leaf, uint256 _index) public pure returns (bool success) {
    return MerkleProof.verifyProof(_proof, _root, _leaf, _index);
  }

  function proveTX(uint _blockIndex, bytes _transactionBytes, bytes _proof) public view returns (bool success) {
    Block memory plasmaBlock = blocks[_blockIndex];
    Transaction.TX memory transaction = Transaction.createTransaction(_transactionBytes);
    bytes32 hash = Transaction.hashTransaction(transaction);

    return MerkleProof.verifyProof(_proof, plasmaBlock.merkleRoot, hash, transaction.uid);
  }

  function proveNoTX(uint _blockIndex, uint _uid, bytes _proof) public view returns (bool success) {
    Block memory plasmaBlock = blocks[_blockIndex];

    return MerkleProof.verifyProof(_proof, plasmaBlock.merkleRoot, 0x0, _uid);
  }

  function() public payable {
    deposit(0x0, msg.value);
  }

  constructor(uint _challengeTimeout) public {
    depositCount = 0;
    blockCount = 0;
    exitsQueue = new PriorityQueue();

    challengeTimeout = _challengeTimeout;
  }
}
