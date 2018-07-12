pragma solidity 0.4.19;

import 'zeppelin-solidity/contracts/ownership/Ownable.sol';
import 'zeppelin-solidity/contracts/math/SafeMath.sol';
import 'zeppelin-solidity/contracts/math/Math.sol';
import './lib/MerkleProof.sol';

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

    mapping(uint => bytes32) public childChain;

    function Plasma() public
    {
        depositCount = 0;
        currentBlkNum = 0;
    }

    function submitBlock(bytes32 _blkRoot, uint _blknum) public onlyOperator
    {
        require(currentBlkNum + 1 == _blknum);
        childChain[_blknum] = _blkRoot;
        currentBlkNum += 1;

        BlockSubmitted(msg.sender, currentBlkNum, _blkRoot);
    }

    uint public depositCount;
    mapping(bytes32 => uint) public wallet;

    uint constant ETH_RATIO = 10**18;

    event Deposit(address _depositor, uint256 indexed _amount, uint256 indexed _uid);

    function deposit(address _currency, uint _amount) payable public
    {
        if (_currency == address(0)) {
            require(_amount * ETH_RATIO == msg.value);
        }
        bytes32 uid = keccak256(_currency, msg.sender, depositCount);
        wallet[uid] = _amount;
        depositCount += 1;

        Deposit(msg.sender, _amount, uint256(uid));
    }

    function verifyProof(bytes _proof, bytes32 _root, bytes32 _leaf, uint256 _index) public constant returns (bool success)
    {
        return MerkleProof.verifyProof(_proof, _root, _leaf, _index);
    }
}