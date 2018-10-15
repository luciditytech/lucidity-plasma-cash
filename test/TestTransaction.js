import { expect } from 'chai';

const crypto = require('crypto');
const secp256k1 = require('secp256k1');
const ethjsUtil = require('ethereumjs-util');

const Transaction = require('../js/lib/Transaction');


function privGen() {
  const buf = Buffer.alloc(32);
  let privKey;
  do {
    privKey = crypto.randomFillSync(buf);
  } while (!secp256k1.privateKeyVerify(privKey));

  return privKey;
}

function privToAddr(privKey) {
  return ethjsUtil.bufferToHex(ethjsUtil.pubToAddress(ethjsUtil.privateToPublic(privKey)));
}


describe('Transaction', () => {
  it('testSign1', () => {
    const tx = new Transaction('0x0', 0, '0x0');
    const priv = privGen();
    const sign = tx.sign(priv);

    expect(tx.verify(sign, privToAddr(priv))).to.equal(true);
  });
});

describe('Transaction', () => {
  it('testSign2', () => {
    const tx1 = new Transaction('0x0', 0, '0x0');
    const tx2 = new Transaction('0x0', 0, '0x1');
    const priv = privGen();
    const sign = tx1.sign(priv);

    expect(tx2.verify(sign, privToAddr(priv))).to.equal(false);
  });
});
