pragma solidity 0.4.19;

import "./lib/RLP.sol";
import "./lib/ECRecovery.sol";

library Transaction {
    using RLP for bytes;
    using RLP for bytes[];
    using RLP for RLP.RLPItem;
    using RLP for RLP.Iterator;

    struct TX {
        uint uid;
        uint prevBlock;
        address newOwner;
    }

    function createTransaction(bytes rlp) internal constant returns (
        TX memory) {
        RLP.RLPItem[] memory txList = rlp.toRLPItem().toList();
        require(txList.length == 3);
        return TX({
            uid: txList[0].toUint(),
            prevBlock: txList[1].toUint(),
            newOwner: txList[2].toAddress()
        });
    }

    function checkSig(bytes32 txHash, bytes sig) internal view returns (bool) {
        return msg.sender == ECRecovery.recover(txHash, sig);
    }

    function hashTransaction(TX memory _transaction) internal returns (bytes32) {
        return keccak256(_transaction.uid, _transaction.prevBlock, _transaction.newOwner);
    }
}
