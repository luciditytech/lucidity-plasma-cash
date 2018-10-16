import PlasmaUser from './PlasmaUser';
import SparseMerkleTree from './SparseMerkleTree';

const debug = 0;

export default class PlasmaOperator extends PlasmaUser {
  constructor(address) {
    super(address);

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

    if (debug) console.log(`[plasmaOperator] create new pool ${this.getCurrentPoolId()}`);
  }

  async submitSingleTx(tx) {
    const { poolId } = await this.addTxToPool(tx);
    const { blockIndex, merkleRoot } = await this.submitPoolTxs();

    return {
      poolId,
      blockIndex,
      merkleRoot,
    };
  }


  /**
   *
   * @param tx Transaction object
   * @private
   */
  async addTxToPool(tx) {
    const uid = tx.getUIDhex();

    if (this.currentTxsPool[uid]) {
      if (debug) console.log(`[plasmaOperator] uid ${uid} is taken`);
      await this.submitPoolTxs();
    }

    const poolId = this.getCurrentPoolId();

    if (this.currentTxsPool[uid]) {
      throw new Error(`[plasmaOperator] we already have Tx with UID: ${uid} in this pool`);
    }

    this.currentTxsPool[uid] = tx.tid();
    this.poolsTxObjects[poolId][uid] = tx;

    this.poolsMerkleTree[poolId] = new SparseMerkleTree(this.currentTxsPool);
    const newRoot = this.poolsMerkleTree[poolId].getHexRoot();
    if (debug) console.log(`[plasmaOperator] new root ${newRoot} for poolId ${poolId}`);

    return { poolId, newRoot };
  }

  getCurrentPoolId() {
    return this.poolsMerkleTree.length - 1;
  }

  getCurrentTxsPool(uid) {
    if (typeof uid === 'undefined') return this.currentTxsPool;
    return (typeof this.currentTxsPool[uid] === 'undefined') ? null : this.currentTxsPool[uid];
  }


  // submit all txs to the Plasma Contract
  async submitPoolTxs() {
    const poolId = this.getCurrentPoolId();

    const blockIndex = await this.plasmaCash.blockCount();

    const root = this.poolsMerkleTree[poolId].getHexRoot();
    if (debug) console.log(`[PlasmaOperator] submitBlock(), ${poolId} => ${root}`);

    const res = await this.plasmaCash.submitBlock(
      root,
      blockIndex.toString(10),
      { from: this.address },
    );
    this.createNewPool();

    return res.LogSubmitBlock[0];
  }

  getTx(poolId, uid) {
    if (typeof this.poolsTxObjects[poolId] === 'undefined') throw Error(`Block number:${uid} does not exist`);
    if (typeof this.poolsTxObjects[poolId][uid] === 'undefined') throw Error(`Tx for uid:${uid} does not exist`);
    return this.poolsTxObjects[poolId][uid];
  }

  getTxBytes(poolId, uid) {
    return this.getTx(poolId, uid).toRLPHex();
  }

  getTxSignature(poolId, uid) {
    return this.getTx(poolId, uid).signature;
  }

  getProof(poolId, uid) {
    return this.poolsMerkleTree[poolId].getHexProofForIndex(uid);
  }

  getRoot(poolId) {
    return this.poolsMerkleTree[poolId].getHexRoot();
  }
}
