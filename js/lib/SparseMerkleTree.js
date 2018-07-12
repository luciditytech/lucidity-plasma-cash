const { sha3, sha256, bufferToHex } = require('ethereumjs-util');

const hash = sha3;

class SparseMerkleTree {
  constructor(input, depth) {
    this.depth = depth || 256;

    const max = Math.pow(2, this.depth - 1);
    //throw new Error('Array is not an array of buffers');
    if (Object.keys(input).length > max) {
      throw new Error('There are too many leaves for the tree to build');
    }
    for (let idx in input) {
      if (idx < 0 || idx >= max) {
        throw new Error('Invalid index')
      }
    }

    this.defaultNodes = SparseMerkleTree.getDefaultNodes(this.depth);
    if (Object.keys(input).length > 0) {
      this.tree = this.createTree(input, this.depth);
      this.root = Object.values(this.tree.slice(-1)[0]).slice(-1)[0];
    } else {
      this.tree = [];
      this.root = this.defaultNodes.slice(-1)[0];
    }
  }

  getProofForIndex(idx) {
    const proof = [];
    for (let level = 0; level < (this.depth - 1); ++level) {
      const siblingIndex = idx % 2 === 0 ? idx + 1 : idx - 1;
      idx = Math.floor(idx / 2);
      if (siblingIndex in this.tree[level]) {
        proof.push(this.tree[level][siblingIndex]);
      } else {
        proof.push(this.defaultNodes[level]);
      }
    }
    return proof;
  }

  getHexProofForIndex(idx) {
    const proof = this.getProofForIndex(idx);

    return SparseMerkleTree.bufArrToHex(proof);
  }

  getRoot() {
    return this.root;
  }

  getHexRoot() {
    return bufferToHex(this.getRoot());
  }

  verifyProof(proof, root, leaf, idx) {
    let computedHash = leaf;
    proof.forEach(function (proofElement) {
      if (idx % 2 === 0) {
        computedHash = hash(Buffer.concat([computedHash, proofElement]));
      } else {
        computedHash = hash(Buffer.concat([proofElement, computedHash]));
      }
      idx = Math.floor(idx / 2);
    }, this);

    return Buffer.compare(computedHash, root) === 0;
  }

  createTree(input, depth) {
    const tree = [input];
    let treeLevel = input;

    for (let level = 0; level < (depth - 1); ++level) {
      const nextLevel = {};
      let prevIndex = -1;

      Object.keys(treeLevel)
        .sort()
        .forEach(function(index) {
          index = parseInt(index);
          const value = treeLevel[index];
          if (index % 2 === 0) {
            nextLevel[Math.floor(index / 2)] = hash(Buffer.concat([value, this.defaultNodes[level]]));
          } else {
            if (index === (prevIndex + 1)) {
              nextLevel[Math.floor(index / 2)] = hash(Buffer.concat([treeLevel[prevIndex], value]));
            } else {
              nextLevel[Math.floor(index / 2)] = hash(Buffer.concat([this.defaultNodes[level], value]));
            }
          }
          prevIndex = index;
        }, this);
      tree.push(treeLevel = nextLevel);
    }
    return tree;
  }

  static bufArrToHex(arr) {
    if (arr.some(el => !Buffer.isBuffer(el))) {
      throw new Error('Array is not an array of buffers');
    }

    return `0x${arr.map(el => el.toString('hex')).join('')}`;
  }

  static getDefaultNodes(depth) {
    const res = [Buffer.alloc(32)];
    for (let level = 1; level < depth; ++level) {
      const prev = res[level - 1];
      res.push(hash(Buffer.concat([prev, prev])))
    }
    return res
  }
}

module.exports = SparseMerkleTree;
