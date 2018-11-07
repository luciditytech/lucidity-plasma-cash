pragma solidity 0.4.24;

import "./RLP.sol";
import "./ECRecovery.sol";

library Transaction {
  using RLP for bytes;
  using RLP for bytes[];
  using RLP for RLP.RLPItem;
  using RLP for RLP.Iterator;

  struct TX {
    uint256 depositId;
    uint256 prevTxBlockIndex;
    address newOwner;
    uint256 targetBlock;
  }

  /// @dev this is ETH prefix, so we can be sure, data was signed in EVM
  bytes constant ETH_PREFIX = "\x19Ethereum Signed Message:\n32";

  function createTransaction(bytes rlp) internal pure returns (TX memory) {
    RLP.RLPItem[] memory txList = rlp.toRLPItem().toList();
    require(txList.length == 4, "txList.length == 4");
    return TX({
      depositId: txList[0].toUint(),
      prevTxBlockIndex: txList[1].toUint(),
      newOwner: txList[2].toAddress(),
      targetBlock: txList[3].toUint()
    });
  }

  function checkSig(address signer, bytes32 txHash, bytes sig) internal pure returns (bool) {
    return signer == ECRecovery.recover(keccak256(abi.encodePacked(ETH_PREFIX, txHash)), sig);
  }

  function hashTransaction(TX memory _tx)
  internal
  pure
  returns (bytes32) {
    return keccak256(abi.encodePacked(_tx.depositId, _tx.prevTxBlockIndex, _tx.newOwner, _tx.targetBlock));
  }
}
