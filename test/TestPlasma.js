import SparseMerkleTree from './lib/SparseMerkleTree';

const { sha3 } = require('ethereumjs-util');

const Web3 = require('web3');

const web3 = new Web3(Web3.currentProvider || 'http://localhost:8545');

const Plasma = artifacts.require('./PlasmaCash.sol');

const challengeTimeoutSec = 2;
const exitBond = 1000;

contract('Plasma', async (accounts) => {
  const [owner] = accounts;

  it('check balance', async () => {
    assert.isTrue((await web3.eth.getBalance(owner) > 1.0));
  });

  let plasma;
  it('create contract', async () => {
    plasma = await Plasma.new(challengeTimeoutSec, exitBond);
  });

  it('has an owner', async () => {
    assert.equal(await plasma.owner(), owner);
  });

  it('set operator', async () => {
    await plasma.setOperator(owner, true);
  });

  it('is operator', async () => {
    assert.isTrue(await plasma.operators.call(owner));
  });

  describe('merkle proof testing', async () => {
    const merkleTree = new SparseMerkleTree({
      5: sha3(Buffer.from('5')),
      4: sha3(Buffer.from('4')),
      2: sha3(Buffer.from('2')),
      1: sha3(Buffer.from('1')),
    }, 4);

    it('test #1', async () => {
      assert.isTrue(await plasma.verifyProof.call(merkleTree.getHexProofForIndex(0), merkleTree.getHexRoot(), '0x0', 0));
    });
    it('test #2', async () => {
      assert.isTrue(await plasma.verifyProof.call(merkleTree.getHexProofForIndex(4), merkleTree.getHexRoot(), SparseMerkleTree.bufArrToHex([sha3(Buffer.from('4'))]), 4));
    });
    it('test #3', async () => {
      assert.isTrue(await plasma.verifyProof.call(merkleTree.getHexProofForIndex(7), merkleTree.getHexRoot(), '0x0', 7));
    });
  });
});
