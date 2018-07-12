const expect = require('chai').expect;
const SparseMerkleTree = require('../js/lib/SparseMerkleTree');

describe('SparseMerkleTree', () => {
  it('testInit0', () => {
    const merkleTree = new SparseMerkleTree({
      0: Buffer.from("0"),
      5: Buffer.from("1"),
      7: Buffer.from("2")
    }, 4);
  });

  it('testInit1', () => {
    expect(function () {
      new SparseMerkleTree({
        "-1": Buffer.from("0"),
        5: Buffer.from("1"),
        7: Buffer.from("2")
      }, 4);
    }).to.throw();
  });

  it('testInit2', () => {
    expect(function () {
      new SparseMerkleTree({
        8: Buffer.from("0"),
        1: Buffer.from("1"),
        2: Buffer.from("2")
      }, 4);
    }).to.throw();
  });

  it('testInit3', () => {
    const merkleTree = new SparseMerkleTree({
      1: Buffer.from("1"),
      2: Buffer.from("2"),
      4: Buffer.from("4"),
      5: Buffer.from("5")
    }, 4);
  });

  it('testProof', () => {
    const merkleTree = new SparseMerkleTree({
      5: Buffer.from("5"),
      4: Buffer.from("4"),
      2: Buffer.from("2"),
      1: Buffer.from("1")
    }, 4);

    expect(merkleTree.verifyProof(merkleTree.getProofForIndex(0), merkleTree.getRoot(), Buffer.alloc(32), 0)).to.equal(true);
    expect(merkleTree.verifyProof(merkleTree.getProofForIndex(1), merkleTree.getRoot(), Buffer.from("1"), 1)).to.equal(true);
    expect(merkleTree.verifyProof(merkleTree.getProofForIndex(2), merkleTree.getRoot(), Buffer.from("2"), 2)).to.equal(true);
    expect(merkleTree.verifyProof(merkleTree.getProofForIndex(3), merkleTree.getRoot(), Buffer.alloc(32), 3)).to.equal(true);
    expect(merkleTree.verifyProof(merkleTree.getProofForIndex(4), merkleTree.getRoot(), Buffer.from("4"), 4)).to.equal(true);
    expect(merkleTree.verifyProof(merkleTree.getProofForIndex(5), merkleTree.getRoot(), Buffer.from("5"), 5)).to.equal(true);
    expect(merkleTree.verifyProof(merkleTree.getProofForIndex(6), merkleTree.getRoot(), Buffer.alloc(32), 6)).to.equal(true);
    expect(merkleTree.verifyProof(merkleTree.getProofForIndex(7), merkleTree.getRoot(), Buffer.alloc(32), 7)).to.equal(true);
  });
});