const web3Utils = require('web3-utils');
const Web3 = require('web3');
const ethjsUtil = require('ethereumjs-util');
const RLP = require('rlp');

const web3 = new Web3(Web3.currentProvider || 'http://localhost:8545');

// const ETH_PREFIX = '\x19Ethereum Signed Message:\n32';

export default class Transaction {
  constructor(sender, depositId, prevTxBlockIndex, newOwner, targetBlock) {
    Transaction.assertAddress(sender);
    Transaction.assertAddress(newOwner);

    if (typeof depositId !== 'string' && typeof depositId !== 'number') {
      throw new Error(`[Transaction] please provide \`depositId\` as a string, not as ${typeof depositId}`);
    }
    if (typeof prevTxBlockIndex !== 'string' && typeof prevTxBlockIndex !== 'number') {
      throw new Error(`[Transaction] please provide \`prevTxBlockIndex\` as a string/number not as ${typeof prevTxBlockIndex}`);
    }
    if (typeof targetBlock !== 'string' && typeof targetBlock !== 'number') {
      throw new Error(`[Transaction] please provide \`targetBlock\` as a string/number not as ${typeof targetBlock}`);
    }

    Object.defineProperty(this, 'depositId', {
      value: Transaction.toPaddedHexString(depositId.toString(16), 32),
    });
    Object.defineProperty(this, 'prevTxBlockIndex', {
      value: parseInt(prevTxBlockIndex, 10),
    });
    Object.defineProperty(this, 'targetBlock', {
      value: parseInt(targetBlock, 10),
    });
    Object.defineProperty(this, 'newOwner', {
      value: newOwner,
    });
    Object.defineProperty(this, 'sender', {
      value: sender,
      writable: true,
    });
    Object.defineProperty(this, 'signature', {
      value: null,
      writable: true,
    });
  }

  getDepositNonceHex() {
    return this.depositId;
  }

  getTargetBlock() {
    return this.targetBlock;
  }

  getPrevBlock() {
    return this.prevTxBlockIndex;
  }

  getNewOwner() {
    return this.newOwner;
  }

  getSender() {
    return this.sender;
  }

  toRLP() {
    return RLP.encode([this.depositId, this.prevTxBlockIndex, this.newOwner, this.targetBlock]);
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
      { type: 'uint', value: this.depositId },
      { type: 'uint', value: this.prevTxBlockIndex },
      { type: 'address', value: this.newOwner },
      { type: 'uint', value: this.targetBlock },
    ];
  }


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

  static fromRLP(encodedBytes) {
    const tx = RLP.decode(encodedBytes);

    const depositId = `0x${tx[0].toString('hex')}`;
    const prevTxBlockIndex = `0x${tx[1].toString('hex')}`;
    const newOwner = `0x${tx[2].toString('hex')}`;
    const targetBlock = `0x${tx[3].toString('hex')}`;

    return {
      depositId: depositId === '0x' ? '0x0' : depositId,
      prevTxBlockIndex: prevTxBlockIndex === '0x' ? '0x0' : prevTxBlockIndex,
      newOwner,
      targetBlock,
    };
  }
}
