
class TokenHistoryItem {
  constructor(tx, proof) {
    Object.defineProperty(this, 'tx', {
      value: tx,
      writable: true,
    });
    Object.defineProperty(this, 'proof', {
      value: proof,
    });
  }
}

export default class TokenHistory {
  constructor() {
    Object.defineProperty(this, 'history', {
      value: [],
      writable: true,
    });
  }

  static assertProof(proof) {
    if ((proof.length - 2) % 64 !== 0) {
      throw new Error(`proof should be multiple of 64, proof length: ${proof.length}`);
    }
  }

  updateSpent(tx) {
    if (typeof tx !== 'object') {
      throw new Error(`tx should be an object, got ${typeof tx}`);
    }

    const id = this.history.length - 1;
    const item = this.history[id];
    item.tx = tx;
    this.history[id] = item;
  }

  addNonSpent(proof) {
    TokenHistory.assertProof(proof);

    this.history.push(new TokenHistoryItem(null, proof));
  }

  getPrevTxBlockIndex() {
    if (!this.history || this.history.length === 0) {
      return 0;
    }

    let lastBlockIndex = -1;
    this.history.map((item) => {
      if (typeof item.tx === 'object') lastBlockIndex = item.tx.getTargetBlock();
      return true;
    });

    if (lastBlockIndex < 0) {
      throw new Error('there is no tx in this history');
    }

    return lastBlockIndex;
  }

  // TODO: add methods for verify the history
}
