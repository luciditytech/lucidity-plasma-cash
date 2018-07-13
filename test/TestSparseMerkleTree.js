const expect = require('chai').expect;
const SparseMerkleTree = require('../js/lib/SparseMerkleTree');


describe('SparseMerkleTree', () => {
 /* it('testInit0', () => {
    const merkleTree = new SparseMerkleTree({
      0: Buffer.from("0"),
      5: Buffer.from("1"),
      7: Buffer.from("2")
    }, 4);
  });

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

  it('test5', () => {
    const merkleTree = new SparseMerkleTree({
      '0xF': Buffer.from("2")
    }, 5);

    for (let i = 0; i < 16; ++i) {
      expect(merkleTree.verifyProof(merkleTree.getProofForIndex('0xf'),
        merkleTree.getRoot(), Buffer.from("2"), i)).to.equal(i === 15);
    }
  });

  it('test6', () => {
    const merkleTree = new SparseMerkleTree({
      '0x6a632b283169bb0e4587422b081393d1c2e29af3c36c24735985e9c95c7c0a02': Buffer.from("0")
    });

    const proof = merkleTree.getProofForIndex('0x6a632b283169bb0e4587422b081393d1c2e29af3c36c24735985e9c95c7c0a02');

    expect(merkleTree.verifyProof(proof,
      merkleTree.getRoot(), Buffer.from("0"), '0x6a632b283169bb0e4587422b081393d1c2e29af3c36c24735985e9c95c7c0a02')).to.equal(true);
  });*/

  /*
  it('testInit2', () => {
    expect(function () {
      new SparseMerkleTree({
        8: Buffer.from("0"),
        1: Buffer.from("1"),
        2: Buffer.from("2")
      }, 4);
    }).to.throw();
  });*/
});