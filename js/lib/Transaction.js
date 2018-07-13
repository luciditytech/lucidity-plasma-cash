const web3Utils = require('web3-utils');
const ethjsUtil = require('ethereumjs-util');
const crypto = require('crypto');
const secp256k1 = require('secp256k1');

const RLP = require('rlp');

class Transaction {
  constructor(uid, prevBlock, newOwner) {
    Object.defineProperty(this, 'uid', {
      value: toPaddedHexString(uid, 32),
    });
    Object.defineProperty(this, 'prevBlock', {
      value: prevBlock,
    });
    Object.defineProperty(this, 'newOwner', {
      value: toPaddedHexString(newOwner, 20),
    });
  }

  toRLP() {
    return RLP.encode([this.uid, this.prevBlock, this.newOwner]);
  }

  toRLPHex() {
    return `0x${this.toRLP().toString('hex')}`;
  }

  tid() {
    return Buffer.from(web3Utils.soliditySha3.apply(null, this.typeVals(true)).substring(2), 'hex');
  }

  tidHex() {
    return `0x${this.tid().toString('hex')}`;
  }

  typeVals() {
    return [
      { type: 'uint', value: this.uid },
      { type: 'uint', value: this.prevBlock },
      { type: 'address', value: this.newOwner }
    ];
  }

  sign(privKey) {
    const { v, r, s } = ethjsUtil.ecsign(new Buffer(this.tidHex().substring(2), 'hex'), privKey);
    return new Buffer(ethjsUtil.toRpcSig(v, r, s).substring(2), 'hex');
  }

  signHex() {
    return `0x${this.sign().toString('hex')}`;
  }

  verify(signature, address) {
    const { v, r, s } = ethjsUtil.fromRpcSig(signature);
    const pubKey = ethjsUtil.ecrecover(this.tid(),
      v,
      r,
      s);

    const addr = ethjsUtil.bufferToHex(ethjsUtil.pubToAddress(pubKey));

    return address === addr;
  }
}

function toPaddedHexString(num, len) {
  num = num.substring(2);
  return `0x${'0'.repeat(len * 2 - num.length) + num}`;
}

module.exports = Transaction;