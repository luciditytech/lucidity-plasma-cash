import Transaction from './Transaction';

const debug = 0;

export default class PlasmaUser {
  constructor(address) {
    Object.defineProperty(this, 'address', {
      value: address,
    });

    Object.defineProperty(this, 'plasmaCash', {
      value: null,
      writable: true,
    });

    Object.defineProperty(this, 'uids', {
      value: [],
      writable: true,
    });

    Object.defineProperty(this, 'prevBlock', {
      value: 0,
      writable: true,
    });

    Object.defineProperty(this, 'tidHex2poolId', {
      value: {},
      writable: true,
    });

    Object.defineProperty(this, 'root2blockIndex', {
      value: {},
      writable: true,
    });

    // uid => blockIndex
    // user stores only last information about uid
    Object.defineProperty(this, 'uid2blockIndex', {
      value: {},
    });

    // blockIndex => array of uids
    Object.defineProperty(this, 'blockIndex2uid', {
      value: {},
    });
  }

  setPlasmaCash(plasma) {
    this.plasmaCash = plasma;
  }

  async depositETH(amount) {
    const coinAddr = '0x0';
    const res = await this.plasmaCash.deposit(
      coinAddr,
      amount,
      { from: this.address, value: amount },
    );

    const [{ uid }] = res.LogDeposit;

    const uidHex = Transaction.toPaddedHexString(uid.toString(16));
    this.uids.push(uidHex);
  }

  // this will allow us to cheat - ant this is good thing for testing
  setPrevBlockNumber(prevBlock) {
    this.prevBlock = prevBlock;
  }

  async sendPETH(uid, newOwnerObj) {
    const tx = new Transaction(this.address, uid, this.prevBlock, newOwnerObj.address);
    const sig = await tx.sign();

    if (debug) console.log(`[plasmaUser] ${this.address} signed tx, signature: ${sig}`);

    return tx;
  }
}
