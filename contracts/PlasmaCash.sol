pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";

import "./lib/MerkleProof.sol";
import "./lib/PriorityQueue.sol";
import "./lib/Transaction.sol";
import "./lib/RLP.sol";


import "./Operable.sol";
import "./Withdrawable.sol";


contract PlasmaCash is Withdrawable, Operable {

  using PriorityQueue for uint256[];
  using SafeMath for uint256;
  using MerkleProof for bytes;

  struct Block {
    bytes32 merkleRoot;
    uint256 timestamp;
  }

  struct Exit {
    address exitor;
    uint256 finalAt;
    bool invalid;
  }

  struct Deposit {
    address owner;
    uint256 amount;
  }

  uint256 public depositId;
  mapping(uint256 => Deposit) public deposits;

  /// @dev depositId => blockIndex => Exit
  mapping(uint256 => mapping(uint256 => Exit)) public exits;
  /// @dev depositId => exitQueue - every deposit has its own queue
  mapping(uint256 => uint256[]) public exitQueue;

  uint256 public exitBond;

  uint256 public challengeTimeout;

  uint256 public chainBlockIndex;
  mapping(uint256 => Block) public blocks;

  event LogDeposit(address indexed depositOwner, uint256 depositId, uint256 depositAmount);
  event LogSubmitBlock(address indexed operator, uint256 blockIndex, bytes32 indexed merkleRoot);

  event LogStartExit(address indexed executor, uint256 depositId, uint256 blockIndex, uint256 finalizeTime);
  event LogChallengeExit(address indexed challenger, uint256 depositId, uint256 blockIndex);

  event LogFinalizeExit(address indexed exitor, uint256 amount, uint256 depositId, uint256 blockIndex);


  modifier onlyWithBond() {
    require(msg.value == exitBond, "exitBond is required");
    _;
  }


  constructor(uint256 _challengeTimeout, uint256 _exitBond) public {
    require(_challengeTimeout > 0, "challenge Timeout missing");
    require(_exitBond > 0, "exit bond missing");

    depositId = 0;
    // must start with 1, because we using reference to parent block, and parent is 0 (deposit)
    chainBlockIndex = 1;

    challengeTimeout = _challengeTimeout;
    exitBond = _exitBond;
  }


  function deposit(address _currency, uint256 _amount)
  public
  payable {
    require(_amount > 0, "deposit amount should be > 0");
    require(msg.sender != address(0), "invalid sender address");

    if (_currency == address(0)) {
      require(_amount == msg.value, "when sending ETH, amount must be equal to value");
    } else {
      revert("currencies are not supported yet");
    }

    uint256 nonce = depositId;
    deposits[nonce] = Deposit(msg.sender, _amount);
    emit LogDeposit(msg.sender, nonce, _amount);

    depositId = nonce.add(1);
  }

  function submitBlock(bytes32 _merkleRoot, uint256 _blockIndex)
  public
  onlyOperator {
    require(chainBlockIndex == _blockIndex, "blockIndex on side-chain is invalid");

    Block memory newBlock = Block(_merkleRoot, block.timestamp);
    blocks[_blockIndex] = newBlock;

    emit LogSubmitBlock(msg.sender, _blockIndex, _merkleRoot);

    chainBlockIndex = chainBlockIndex.add(1);
  }


  function startDepositExit(uint256 _depositId)
  public
  onlyWithBond
  payable {
    require(exits[_depositId][0].finalAt == 0, "there is already pending deposit exit");

    Deposit storage depositPtr = deposits[_depositId];

    require(depositPtr.owner == msg.sender, "invalid deposit owner");

    uint256 finalAt = createExitAndPriority(_depositId, 0);

    emit LogStartExit(msg.sender, _depositId, 0, finalAt);
  }

  function startTxExit(bytes _txBytes, bytes _proof, bytes _signature, address _spender)
  public
  onlyWithBond
  payable {

    Transaction.TX memory transaction = Transaction.createTransaction(_txBytes);
    validateProofSignaturesAndTxData(_txBytes, _proof, _signature, _spender);

    require(exits[transaction.depositId][transaction.targetBlock].finalAt == 0, "exit already exists");

    Deposit storage depositPtr = deposits[transaction.depositId];
    require(depositPtr.amount > 0, "deposit not exists");
    require(transaction.newOwner == msg.sender, "you are not the owner");


    uint256 finalAt = createExitAndPriority(transaction.depositId, transaction.targetBlock);

    emit LogStartExit(msg.sender, transaction.depositId, transaction.targetBlock, finalAt);
  }


  function createExitAndPriority(uint256 _depositId, uint256 _blockIndex)
  private
  returns (uint256 finalAt) {
    finalAt = block.timestamp.add(challengeTimeout);
    exits[_depositId][_blockIndex] = Exit(msg.sender, finalAt, false);

    exitQueue[_depositId].insert(_blockIndex);
  }


  function challengeExit(bytes _txBytes, bytes _proof, bytes _signature)
  public {

    Transaction.TX memory transaction = Transaction.createTransaction(_txBytes);

    require(deposits[transaction.depositId].amount > 0, "deposit does not exist");

    Exit storage exitPtr = exits[transaction.depositId][transaction.prevTxBlockIndex];
    require(exitPtr.exitor != address(0), "this exit does not exist");
    require(!exitPtr.invalid, "exit already challenged");
    require(exitPtr.exitor != msg.sender, "anti-blocking condition: you can't challenge yourself");

    // we will allow users to challenge exit even after challenge time, until someone finalize it
    // allow: require(exit.finalAt > block.timestamp, "exit is final, you can't challenge it");

    validateProofSignaturesAndTxData(_txBytes, _proof, _signature, exitPtr.exitor);

    exitPtr.invalid = true;

    addBalance(msg.sender, exitBond);

    emit LogChallengeExit(msg.sender, transaction.depositId, transaction.prevTxBlockIndex);
  }


  function validateProofSignaturesAndTxData(bytes _txBytes, bytes _proof, bytes _signature, address _signer)
  public
  view
  returns (bool) {
    Transaction.TX memory transaction = Transaction.createTransaction(_txBytes);
    require(transaction.prevTxBlockIndex < chainBlockIndex, "blockchain is the future, but your tx must be from the past");
    require(transaction.targetBlock > transaction.prevTxBlockIndex, "invalid targetBlock/prevTxBlockIndex");

    bytes32 hash = Transaction.hashTransaction(transaction);

    require(transaction.newOwner != _signer, "preventing sending loop");
    require(_proof.verifyProof(blocks[transaction.targetBlock].merkleRoot, hash, transaction.depositId), "MerkleProof.verifyProof() failed");
    require(Transaction.checkSig(_signer, hash, _signature), "Transaction.checkSig() failed");

    return true;
  }


  function getNextExit(uint256 _depositId)
  public
  view
  returns (uint256 blockIndex) {
    if (exitQueue[_depositId].currentSize() == 0) return 0;
    blockIndex = exitQueue[_depositId].getMin();
  }


  function finalizeExits(uint256 _depositId)
  public  {
    uint256 timestamp = block.timestamp;

    uint256 blockIndex = getNextExit(_depositId);
    Exit memory exit = exits[_depositId][blockIndex];

    while (exit.invalid || (exit.finalAt > 0 && exit.finalAt < timestamp)) {

      if (!exit.invalid) {
        uint256 amount = deposits[_depositId].amount;

        if (amount > 0) {

          uint256 exitAmount = amount.add(exitBond);
          addBalance(exit.exitor, exitAmount);

          emit LogFinalizeExit(exit.exitor, exitAmount, _depositId, blockIndex);

          delete deposits[_depositId];
        }
      }

      delete exits[_depositId][blockIndex];
      exitQueue[_depositId].delMin();

      blockIndex = getNextExit(_depositId);
      exit = exits[_depositId][blockIndex];

    }
  }



  // helpers methods - just for testing, can be removed for release


  function verifyProof(bytes _proof, bytes32 _root, bytes32 _leaf, uint256 _index)
  public
  pure
  returns (bool) {
    return _proof.verifyProof(_root, _leaf, _index);
  }

  function proveTX(uint256 _blockIndex, bytes _transactionBytes, bytes _proof)
  public
  view
  returns (bool) {
    Block memory newBlock = blocks[_blockIndex];
    Transaction.TX memory transaction = Transaction.createTransaction(_transactionBytes);
    bytes32 hash = Transaction.hashTransaction(transaction);

    return _proof.verifyProof(newBlock.merkleRoot, hash, transaction.depositId);
  }

  function proveNoTX(uint256 _blockIndex, uint256 _depositId, bytes _proof)
  public
  view
  returns (bool) {
    Block memory newBlock = blocks[_blockIndex];

    return _proof.verifyProof(newBlock.merkleRoot, 0x0, _depositId);
  }

  function helperTestSig(address signer, bytes32 txHash, bytes sig) public pure returns (bool) {
    return Transaction.checkSig(signer, txHash, sig);
  }

}
