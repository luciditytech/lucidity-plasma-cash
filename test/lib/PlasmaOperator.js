import PlasmaUser from './PlasmaUser';
import SparseMerkleTree from './SparseMerkleTree';

const debug = 0;

export default class PlasmaOperator extends PlasmaUser {
  constructor(address) {
    super(address);

    Object.defineProperty(this, 'blockIndex', {
      value: 0,
      writable: true,
    });

    Object.defineProperty(this, 'poolsMerkleTree', {
      // poolId => tree
      value: [],
      writable: true,
    });

    Object.defineProperty(this, 'poolsTxObjects', {
      // poolId => {uid => tidObj}
      value: [],
      writable: true,
    });

    Object.defineProperty(this, 'currentTxsPool', {
      // uid => tid
      value: {},
      writable: true,
    });


    this.createNewPool();
  }

  createNewPool() {
    this.poolsMerkleTree.push({});
    this.poolsTxObjects.push({});
    this.currentTxsPool = {};
    this.blockIndex += 1;

    if (debug) console.log(`[plasmaOperator] create new pool ${this.getCurrentPoolId()}`);
  }

  async submitSingleTx(tx) {
    const { poolId } = await this.addTxToPool(tx);
    const { blockIndex, merkleRoot } = await this.submitAllCurrentPoolTxs();

    this.validateTargetBlockForSubmittedTxs(poolId, blockIndex);

    return {
      poolId,
      blockIndex,
      merkleRoot,
    };
  }


  async addTxToPool(tx) {
    const depositId = tx.getDepositNonceHex();

    if (this.currentTxsPool[depositId]) {
      if (debug) console.log(`[plasmaOperator] depositId ${depositId} is taken`);
      await this.submitAllCurrentPoolTxs();
    }

    const poolId = this.getCurrentPoolId();

    if (this.currentTxsPool[depositId]) {
      throw new Error(`[plasmaOperator] we already have Tx with depositId: ${depositId} in this pool`);
    }

    this.currentTxsPool[depositId] = tx.tid();
    this.poolsTxObjects[poolId][depositId] = tx;

    this.poolsMerkleTree[poolId] = new SparseMerkleTree(this.currentTxsPool);
    const newRoot = this.poolsMerkleTree[poolId].getHexRoot();
    if (debug) console.log(`[plasmaOperator] new root ${newRoot} for poolId ${poolId}`);

    return { poolId, newRoot };
  }

  getCurrentPoolId() {
    return this.poolsMerkleTree.length - 1;
  }


  async submitAllCurrentPoolTxs() {
    const poolId = this.getCurrentPoolId();

    const root = this.poolsMerkleTree[poolId].getHexRoot();
    if (debug) console.log(`[PlasmaOperator] submitBlock(), ${poolId} => ${root}`);

    const res = await this.plasmaCash.submitBlock(
      root,
      this.blockIndex,
      { from: this.address },
    );

    this.createNewPool();

    return res.LogSubmitBlock[0];
  }

  validateTargetBlockForSubmittedTxs(poolId, blockIndex) {
    Object.keys(this.poolsTxObjects[poolId]).map((nonce) => {
      const tx = this.getTx(poolId, nonce);
      if (tx.targetBlock.toString() !== blockIndex.toString(10)) {
        throw new Error(`targetBlock error, got ${typeof tx.targetBlock}:${tx.targetBlock} should be ${typeof blockIndex}:valid`);
      }
      return true;
    });
  }

  getTx(poolId, depositId) {
    if (typeof this.poolsTxObjects[poolId] === 'undefined') throw Error(`Pool ID: ${poolId} does not exist`);
    if (typeof this.poolsTxObjects[poolId][depositId] === 'undefined') throw Error(`Tx for uid:${depositId} does not exist`);
    return this.poolsTxObjects[poolId][depositId];
  }

  getProof(poolId, depositId) {
    return this.poolsMerkleTree[poolId].getHexProofForIndex(depositId);
  }
}
