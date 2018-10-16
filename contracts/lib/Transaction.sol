pragma solidity 0.4.24;

import "./RLP.sol";
import "./ECRecovery.sol";

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

  /// @dev this is ETH prefix, so we can be sure, data was signed in EVM
  bytes constant ETH_PREFIX = "\x19Ethereum Signed Message:\n32";

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
    return signer == ECRecovery.recover(keccak256(abi.encodePacked(ETH_PREFIX, txHash)), sig);
  }

  function hashTransaction(TX memory _transaction) internal pure returns (bytes32) {
    return keccak256(abi.encodePacked(_transaction.uid, _transaction.prevBlock, _transaction.newOwner));
  }
}
