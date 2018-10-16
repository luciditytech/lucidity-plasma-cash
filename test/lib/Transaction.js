const web3Utils = require('web3-utils');
const Web3 = require('web3');
const ethjsUtil = require('ethereumjs-util');
const RLP = require('rlp');

const web3 = new Web3(Web3.currentProvider || 'http://localhost:8545');

// const ETH_PREFIX = '\x19Ethereum Signed Message:\n32';

export default class Transaction {
  constructor(sender, uid, prevBlock, newOwner) {
    Transaction.assertAddress(sender);
    Transaction.assertAddress(newOwner);

    if (typeof uid !== 'string' && typeof uid !== 'number') {
      throw new Error(`[Transaction] please provide \`uid\` as a string, not as ${typeof uid}`);
    }
    if (typeof prevBlock !== 'string' && typeof prevBlock !== 'number') {
      throw new Error(`[Transaction] please provide \`prevBlock\` as a string/number not as ${typeof prevBlock}`);
    }


    Object.defineProperty(this, 'uid', {
      value: Transaction.toPaddedHexString(uid.toString(16), 32),
    });
    Object.defineProperty(this, 'prevBlock', {
      value: prevBlock,
    });
    Object.defineProperty(this, 'operatorPoolId', {
      value: prevBlock,
    });
    Object.defineProperty(this, 'newOwner', {
      value: newOwner,
    });
    Object.defineProperty(this, 'sender', {
      value: sender,
    });
    Object.defineProperty(this, 'signature', {
      value: null,
      writable: true,
    });
  }

  getUIDhex() {
    return this.uid;
  }

  getPrevBlock() {
    return this.prevBlock;
  }

  getNewOwner() {
    return this.newOwner;
  }

  getSender() {
    return this.sender;
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
      { type: 'address', value: this.newOwner },
    ];
  }

  /**
   *
   * @param privKey
   * @returns {Buffer} signature
   */
  signByPrivKey(privKey) {
    const { v, r, s } = ethjsUtil.ecsign(Buffer.from(this.tidHex().substring(2), 'hex'), privKey);
    return Buffer.from(ethjsUtil.toRpcSig(v, r, s).substring(2), 'hex');
  }

  async sign() {
    if (!this.signature) {
      const toSign = this.tidHex();
      this.signature = await web3.eth.sign(toSign, this.sender);

      if (!this.verify()) {
        throw new Error('[Transaction] can`t sign transaction');
      }
    }

    return this.signature;
  }

  /* signHex_old(privKey) {
    return `0x${this.sign(privKey).toString('hex')}`;
  } // */
  signHex() {
    return `0x${this.sign().toString('hex')}`;
  }


  verifySignature(signature, address) {
    const { v, r, s } = ethjsUtil.fromRpcSig(signature);
    const pubKey = ethjsUtil.ecrecover(this.tid(),
      v,
      r,
      s);

    return address === ethjsUtil.bufferToHex(ethjsUtil.pubToAddress(pubKey));
  }

  verify(address) {
    if (!this.signature) return false;
    const addr = address || this.sender;
    // const toSign = web3.utils.soliditySha3(ETH_PREFIX, this.tidHex().substring(2));
    const toSign = this.tidHex();
    return addr.toLowerCase() === web3.eth.accounts.recover(toSign, this.signature).toLowerCase();
  }

  static assertAddress(address) {
    if (!web3.utils.isAddress(address)) {
      throw new Error(`"${address}" is not valid address.`);
    }
  }

  static toPaddedHexString(num, len) {
    const length = len || 32;
    const number = (typeof num === 'string') ? num.replace('0x', '') : num.toString(16);
    const rep = length * 2 - number.length;
    return rep > 0 ? `0x${'0'.repeat(rep) + number}` : `0x${number}`;
  }
}
