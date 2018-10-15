pragma solidity 0.4.24;

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

  function createTransaction(bytes rlp) internal pure returns (TX memory) {
    RLP.RLPItem[] memory txList = rlp.toRLPItem().toList();
    require(txList.length == 3, "txList.length == 3");
    return TX({
      uid: txList[0].toUint(),
      prevBlock: txList[1].toUint(),
      newOwner: txList[2].toAddress()
    });
  }

  function checkSig(address signer, bytes32 txHash, bytes sig) internal pure returns (bool) {
    return signer == ECRecovery.recover(txHash, sig);
  }

  function hashTransaction(TX memory _transaction) internal pure returns (bytes32) {
    return keccak256(abi.encodePacked(_transaction.uid, _transaction.prevBlock, _transaction.newOwner));
  }
}
