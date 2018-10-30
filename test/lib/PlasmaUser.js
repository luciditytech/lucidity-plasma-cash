import Transaction from './Transaction';
import TokenHistory from './TokenHistory';

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

    Object.defineProperty(this, 'depositsNonces', {
      value: [],
      writable: true,
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

    const [{ depositId }] = res.LogDeposit;

    const depositIdHex = Transaction.toPaddedHexString(depositId.toString(16));
    this.depositsNonces[depositIdHex] = new TokenHistory();
  }

  getLastDepositNonce() {
    return Object.keys(this.depositsNonces).pop();
  }

  getPrevTxBlockFor(depositId) {
    return this.depositsNonces[depositId].getPrevTxBlockIndex();
  }


  async createUTXO(depositId, newOwnerObj) {
    const prevTxBlock = this.getPrevTxBlockFor(depositId);
    const targetBlock = await this.plasmaCash.chainBlockIndex();

    const tx = new Transaction(
      this.address,
      depositId,
      prevTxBlock,
      newOwnerObj.address,
      targetBlock.toString(10),
    );

    const sig = await tx.sign();

    if (debug) console.log(`[plasmaUser] ${this.address} signed tx, signature: ${sig}`);

    return tx;
  }


  updateTokenHistoryAfterOperatorSubmitBlock(operator) {
    Object.keys(this.depositsNonces).map((depositId) => {
      if (this.depositsNonces[depositId] === null) return false;

      const poolId = operator.getCurrentPoolId() - 1;
      const proof = operator.getProof(poolId, depositId);
      this.depositsNonces[depositId].addNonSpent(proof);
      return true;
    });
  }

  transferNonceHistoryToNewOwner(nonce, newOwner) {
    const tokenHistory = this.depositsNonces[nonce];
    this.depositsNonces[nonce] = null;
    /* eslint-disable-next-line */
    newOwner.depositsNonces[nonce] = tokenHistory;
  }

  saveTxToHistory(nonce, tx) {
    this.depositsNonces[nonce].updateSpent(tx);
  }

  getRootAndTxFromHistory(depositId, blockIndex) {
    // blockIndex - 1, because on-chain we start from 1, and here from 0
    return this.depositsNonces[depositId]
      ? this.depositsNonces[depositId].history[blockIndex - 1]
      : null;
  }

  printHistory(depositId) {
    console.log(`history for ${depositId} has ${this.depositsNonces[depositId].history.length} items.`);
    this.depositsNonces[depositId].history.map((item, i) => {
      console.log(`[${i}] tx: ${typeof item.tx}, proof:${typeof item.proof}`);
      return true;
    });
  }
}
