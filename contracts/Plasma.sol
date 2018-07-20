pragma solidity 0.4.19;

import 'zeppelin-solidity/contracts/ownership/Ownable.sol';
import 'zeppelin-solidity/contracts/math/SafeMath.sol';
import 'zeppelin-solidity/contracts/math/Math.sol';
import './lib/MerkleProof.sol';
import './DataStructures/PriorityQueue.sol';
import './Transaction.sol';

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
  mapping(uint => Block) public childChain;

  event BlockSubmitted(uint indexed blockIndex, address operator, bytes32 indexed merkleRoot);

  function submitBlock(bytes32 _merkleRoot, uint _blockIndex) public onlyOperator {
    require(blockCount == _blockIndex);

    Block memory newBlock = Block(_merkleRoot, block.timestamp);

    childChain[_blockIndex] = newBlock;

    BlockSubmitted(_blockIndex, msg.sender, _merkleRoot);

    blockCount += 1;
  }

  // deposits
  mapping(uint => uint) public depositBalance;
  uint public depositCount;

  event Deposit(uint indexed uid, address depositor, uint amount);

  function deposit(address _currency, uint _amount) payable public {
    require(_amount > 0);

    if (_currency == address(0)) {
      require(_amount == msg.value);
    } else {
      throw;
    }

    uint uid = depositCount;
    depositBalance[uid] = _amount;

    Deposit(uid, msg.sender, _amount);

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
    require(depositBalance[_uid] > 0); // check if the deposit exists

    ExitTX memory exitTX = ExitTX(msg.sender, block.timestamp + challengeTimeout);
    addExitToQueue(_uid, exitTX);

    WithdrawDeposit(msg.sender, _uid, block.timestamp, depositBalance[_uid]);
  }

  function addExitToQueue(uint _uid, ExitTX memory exitTX) private {
    require(exits[_uid].timestamp == 0); // check if correspondent withdrawal has been already requested

    uint priority = exitTX.timestamp << 128 | _uid;
    exitsQueue.insert(priority);
    exits[_uid] = exitTX;

    ExitStarted(priority);
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
        uint amount = depositBalance[uid];
        exitTX.exitor.transfer(amount);

        FinalizedExit(exitTX.exitor, amount, uid, timestamp);

        delete exits[uid];
        delete depositBalance[uid];
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
    Block memory block = childChain[_blockIndex];
    Transaction.TX memory transaction = Transaction.createTransaction(_transactionBytes);

    require(depositBalance[transaction.uid] > 0); // check if the deposit exists

    //require(exits[transaction.uid].timestamp >= block.timestamp); // check if challenge timeout is off

    bytes32 hash = Transaction.hashTransaction(transaction);

    require(MerkleProof.verifyProof(_proof, block.merkleRoot, hash, transaction.uid)); // check is TX exists

    address exitor = exits[transaction.uid].exitor;

    require(Transaction.checkSig(exitor, hash, signature)); // check if the correspondent signature correct

    require(exitor != transaction.newOwner); // check if the owner has been changed

    delete exits[transaction.uid]; // delete exit
    // TODO: prevent further challengeWithdrawDeposit calls with the same UID

    DepositWithdrawChallenged(msg.sender, exitor, transaction.uid, _blockIndex);

    return true;
  }

  // temp methods
  function verifyProof(bytes _proof, bytes32 _root, bytes32 _leaf, uint256 _index) public constant returns (bool success) {
    return MerkleProof.verifyProof(_proof, _root, _leaf, _index);
  }

  function proveTX(uint _blockIndex, bytes _transactionBytes, bytes _proof) public constant returns (bool success) {
    Block memory block = childChain[_blockIndex];
    Transaction.TX memory transaction = Transaction.createTransaction(_transactionBytes);
    bytes32 hash = Transaction.hashTransaction(transaction);

    return MerkleProof.verifyProof(_proof, block.merkleRoot, hash, transaction.uid);
  }

  function proveNoTX(uint _blockIndex, uint _uid, bytes _proof) public constant returns (bool success) {
    Block memory block = childChain[_blockIndex];

    return MerkleProof.verifyProof(_proof, block.merkleRoot, 0x0, _uid);
  }

  function() public payable {
    deposit(0x0, msg.value);
  }

  function Plasma(uint _challengeTimeout) public {
    depositCount = 0;
    blockCount = 0;
    exitsQueue = new PriorityQueue();

    challengeTimeout = _challengeTimeout;
  }
}
