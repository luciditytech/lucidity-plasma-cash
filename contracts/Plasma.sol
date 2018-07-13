pragma solidity 0.4.19;

import 'zeppelin-solidity/contracts/ownership/Ownable.sol';
import 'zeppelin-solidity/contracts/math/SafeMath.sol';
import 'zeppelin-solidity/contracts/math/Math.sol';
import './lib/MerkleProof.sol';
import './Transaction.sol';

import "./lib/RLP.sol";

contract Plasma is Ownable {

    // operators
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

    uint public currentBlkNum;

    event BlockSubmitted(address _operator, uint256 indexed _totalCount, bytes32 indexed _hash);

    struct Block {
        uint block_num;
        bytes32 merkle_root;
        uint time;
    }

    mapping(uint => Block) public childChain;

    function Plasma() public
    {
        depositCount = 0;
        currentBlkNum = 0;
    }

    function submitBlock(bytes32 _blkRoot, uint _blknum) public onlyOperator
    {
        require(currentBlkNum + 1 == _blknum);

        Block memory newBlock = Block({
            block_num: _blknum,
            merkle_root: _blkRoot,
            time: block.timestamp
        });


        childChain[_blknum] = newBlock;
        currentBlkNum += 1;

        BlockSubmitted(msg.sender, currentBlkNum, _blkRoot);
    }

    uint public depositCount;
    mapping(bytes32 => uint) public wallet;

    uint constant ETH_RATIO = 10**18;

    event Deposit(address _depositor, uint indexed _amount, bytes32 indexed _uid);

    function deposit(address _currency, uint _amount) payable public
    {
        if (_currency == address(0)) {
            require(_amount * ETH_RATIO == msg.value);
        } else {
            throw;
        }
        bytes32 uid = keccak256(msg.sender, _currency, depositCount);
        wallet[uid] = _amount;
        depositCount += 1;

        Deposit(msg.sender, _amount, uid);
    }

    function verifyProof(bytes _proof, bytes32 _root, bytes32 _leaf, uint256 _index) public constant returns (bool success)
    {
        return MerkleProof.verifyProof(_proof, _root, _leaf, _index);
    }

    function proveTX(uint _blockIndex, bytes _transactionBytes, bytes _proof) public constant returns (bool success)
    {
        Block memory block = childChain[_blockIndex];
        assert(block.block_num == _blockIndex);
        Transaction.TX memory transaction = Transaction.createTransaction(_transactionBytes);
        bytes32 hash = Transaction.hashTransaction(transaction);

        return MerkleProof.verifyProof(_proof, block.merkle_root, hash, transaction.uid);
    }

    function proveNoTX(uint _blockIndex, uint _uid, bytes _proof) public constant returns (bool success)
    {
        Block memory block = childChain[_blockIndex];
        assert(block.block_num == _blockIndex);

        return MerkleProof.verifyProof(_proof, block.merkle_root, 0x0, _uid);
    }
}