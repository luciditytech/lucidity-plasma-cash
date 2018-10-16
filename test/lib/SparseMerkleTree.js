const { sha3, bufferToHex } = require('ethereumjs-util');
const BigNumber = require('bignumber.js');

const hash = sha3;


function div2(num) {
  const bigNumber = BigNumber(num);
  return `0x${bigNumber.dividedToIntegerBy(2).toString(16)}`;
}

function add(num, val) {
  const bigNumber = BigNumber(num);
  return `0x${bigNumber.plus(val).toString(16)}`;
}

function isEven(num) {
  const bigNumber = BigNumber(num);
  const div = `0x${bigNumber.dividedToIntegerBy(2).toString(16)}`;
  const mul = `0x${BigNumber(div).multipliedBy(2).toString(16)}`;
  return mul === num;
}

export default class SparseMerkleTree {
  constructor(input, depth) {
    this.depth = depth || 256;
    const len = Object.keys(input).length;
    const max = 2 ** (this.depth - 1);
    if (len > max) {
      throw new Error('There are too many leaves for the tree to build');
    }

    // convert indices to HEX strings
    const hexInput = {};
    Object.keys(input).forEach((index) => {
      if (index < 0) {
        throw new Error('Cannot parse negative indices');
      }
      try {
        hexInput[add(index, 0)] = input[index];
      } catch (err) {
        throw new Error(`Cannot parse an index: ${index}`);
      }

      // TODO: check if indexes within [0, max)
    });

    this.defaultNodes = SparseMerkleTree.getDefaultNodes(this.depth);

    if (len > 0) {
      this.tree = this.createTree(hexInput, this.depth);
      this.root = Object.values(this.tree.slice(-1)[0]).slice(-1)[0];
    } else {
      this.tree = [];
      this.root = this.defaultNodes.slice(-1)[0];
    }
  }

  getProofForIndex(index) {
    let idx = add(index, 0);
    const proof = [];
    for (let level = 0; level < (this.depth - 1); level += 1) {
      const siblingIndex = isEven(idx) ? add(idx, 1) : add(idx, -1);
      idx = div2(idx);
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

  static verifyProof(proof, root, leaf, index) {
    let idx = add(index, 0);
    let computedHash = leaf;
    proof.forEach((proofElement) => {
      if (isEven(idx)) {
        computedHash = hash(Buffer.concat([computedHash, proofElement]));
      } else {
        computedHash = hash(Buffer.concat([proofElement, computedHash]));
      }
      idx = div2(idx);
    });

    return Buffer.compare(computedHash, root) === 0;
  }

  createNextLevel(level, treeLevel) {
    const nextLevel = {};
    let prevIndex = -1;

    Object.keys(treeLevel)
      .sort()
      .forEach((index) => {
        const value = treeLevel[index];
        if (isEven(index)) {
          nextLevel[div2(index)] = hash(Buffer.concat([value, this.defaultNodes[level]]));
        } else if (index === add(prevIndex, 1)) {
          nextLevel[div2(index)] = hash(Buffer.concat([treeLevel[prevIndex], value]));
        } else {
          nextLevel[div2(index)] = hash(Buffer.concat([this.defaultNodes[level], value]));
        }
        prevIndex = index;
      }, this);

    return nextLevel;
  }

  createTree(input, depth) {
    const tree = [input];
    let treeLevel = input;

    for (let level = 0; level < (depth - 1); level += 1) {
      const nextLevel = this.createNextLevel(level, treeLevel);
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
    for (let level = 1; level < depth; level += 1) {
      const prev = res[level - 1];
      res.push(hash(Buffer.concat([prev, prev])));
    }
    return res;
  }
}
