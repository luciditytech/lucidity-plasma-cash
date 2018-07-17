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

    function setOperator(address _op, bool _status) public returns (bool success) {
        require(msg.sender == owner);
        operators[_op] = _status;
        return true;
    }

    function isOperator() public view returns (bool success) {
        return operators[msg.sender];
    }

    // blocks
    struct Block {
        uint blockIndex;
        bytes32 merkleRoot;
        uint256 timestamp;
    }

    uint public blockCount;
    mapping(uint => Block) public childChain;

    event BlockSubmitted(uint indexed _blockIndex, address _operator, bytes32 indexed _merkleRoot);

    function submitBlock(bytes32 _merkleRoot, uint _blockIndex) public onlyOperator {
        require(blockCount + 1 == _blockIndex);

        Block memory newBlock = Block({
            blockIndex: _blockIndex,
            merkleRoot: _merkleRoot,
            timestamp: block.timestamp
        });

        blockCount = _blockIndex;

        childChain[blockCount] = newBlock;

        BlockSubmitted(_blockIndex, msg.sender, _merkleRoot);
    }

    // deposits

    mapping(uint => bytes32) public depositIndex;
    mapping(bytes32 => uint) public depositBalance;
    uint public depositCount;

    event Deposit(uint indexed _depositIndex, bytes32 indexed _uid, address _depositor, uint _amount);

    function deposit(address _currency, uint _amount) payable public {
        require(_amount > 0);

        if (_currency == address(0)) {
            require(_amount == msg.value);
        } else {
            throw;
        }
        bytes32 uid = keccak256(msg.sender, _currency, depositCount);

        depositIndex[depositCount] = uid;
        depositBalance[uid] = _amount;

        Deposit(depositCount, uid, msg.sender, _amount);

        depositCount += 1;
    }

    // withdrawals

    struct ExitTX {
        address exitor;
        uint timestamp;
    }

    PriorityQueue exitsQueue;
    mapping(bytes32 => ExitTX) public exits;

    event WithdrawDeposit(address _depositor, uint indexed _depositIndex, bytes32 indexed _uid, uint256 indexed _timestamp, uint _amount);
    event ExitStarted(uint indexed _priority);

    function withdrawDeposit(uint _depositIndex, address _currency) public {
        bytes32 uid = depositIndex[_depositIndex];
        require(uid != 0x0);

        // check if msg.sender is the right one to withdraw
        require(keccak256(msg.sender, _currency, _depositIndex) == uid);

        ExitTX memory exitTX = ExitTX({
            exitor: msg.sender,
            timestamp: block.timestamp + 60
        });

        addExitToQueue(uid, _depositIndex, exitTX);

        uint amount = depositBalance[uid];

        WithdrawDeposit(msg.sender, _depositIndex, uid, block.timestamp, amount);
    }

    function addExitToQueue(bytes32 _uid, uint _depositIndex, ExitTX memory exitTX) private {
        // check if the withdrawal has been already requested
        require(exits[_uid].timestamp == 0);

        uint priority = exitTX.timestamp << 128 | _depositIndex;
        exitsQueue.insert(priority);
        exits[_uid] = exitTX;

        ExitStarted(priority);
    }

    function getNextExit() public view returns (uint _depositIndex, bytes32 _uid, uint _timestamp) {
        uint256 priority = exitsQueue.getMin();
        _depositIndex = uint256(uint128(priority));
        _uid = depositIndex[_depositIndex];
        _timestamp = priority >> 128;
    }

    event FinalizedExit(address _depositor, uint indexed _depositIndex, uint _amount,  bytes32 indexed _uid, uint256 indexed _timestamp);

    function finalizeExits() public returns (uint _num) {
        uint index;
        bytes32 uid;
        uint exitTimestamp;

        uint timestamp = block.timestamp;

        (index, uid, exitTimestamp) = getNextExit();
        while (exitTimestamp < timestamp) {

            ExitTX memory exitTX = exits[uid];

            uint amount = depositBalance[uid];
            exitTX.exitor.transfer(amount);

            FinalizedExit(exitTX.exitor, index, amount, uid, timestamp);

            exitsQueue.delMin();
            _num += 1;

            if (exitsQueue.currentSize() > 0) {
                (index, uid, exitTimestamp) = getNextExit();
            } else {
                return;
            }
        }
    }

    // temp methods
    function verifyProof(bytes _proof, bytes32 _root, bytes32 _leaf, uint256 _index) public constant returns (bool success) {
        return MerkleProof.verifyProof(_proof, _root, _leaf, _index);
    }

    function proveTX(uint _blockIndex, bytes _transactionBytes, bytes _proof) public constant returns (bool success) {
        Block memory block = childChain[_blockIndex];
        assert(block.blockIndex == _blockIndex);
        Transaction.TX memory transaction = Transaction.createTransaction(_transactionBytes);
        bytes32 hash = Transaction.hashTransaction(transaction);

        return MerkleProof.verifyProof(_proof, block.merkleRoot, hash, transaction.uid);
    }

    function proveNoTX(uint _blockIndex, uint _uid, bytes _proof) public constant returns (bool success) {
        Block memory block = childChain[_blockIndex];
        assert(block.blockIndex == _blockIndex);

        return MerkleProof.verifyProof(_proof, block.merkleRoot, 0x0, _uid);
    }

    function () public payable {
        deposit(0x0, msg.value);
    }

    function Plasma() public {
        depositCount = 0;
        blockCount = 0;
        exitsQueue = new PriorityQueue();
    }
}
