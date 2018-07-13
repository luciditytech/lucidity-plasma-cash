const ethjsUtil = require('ethereumjs-util');
const secp256k1 = require('secp256k1');
const crypto = require('crypto');

const SparseMerkleTree = require('../js/lib/SparseMerkleTree');

const { sha3, sha256, bufferToHex } = require('ethereumjs-util');

const Plasma = artifacts.require('./Plasma.sol');

contract('Plasma', async ([owner]) => {

  const ETH_RATIO = 1000000000000000000; // 10^18

  it('check balance', async function () {
    assert.isTrue((await web3.eth.getBalance(owner) > 1.0));
  });

  let plasma;
  it('create contract', async function () {
    plasma = await Plasma.new();
  });

  it('has an owner', async function () {
    assert.equal(await plasma.owner(), owner);
  });

  it('set operator', async function () {
    await plasma.setOperator(owner, true);
  });

  it('is operator', async function () {
    assert.isTrue(await plasma.isOperator());
  });

  it('deposit 1', async function () {
    //depositPriv = privGen();

    const amount = 1;

    const depositRes = (await plasma.deposit('0x0', amount, {
      value: amount * ETH_RATIO,
    }));

    const depositEvent = depositRes.logs.find(x => x.event === 'Deposit');

    assert.equal(depositEvent.args._amount, amount);
  });

  it('submit block', async function () {

    const submitRes = (await plasma.submitBlock('0x0', 1));

    const submitEvent = submitRes.logs.find(x => x.event === 'BlockSubmitted');

    assert.equal(submitEvent.args._totalCount, 1);
    assert.equal(submitEvent.args._hash, 0x0);
  });

  it('test merkle proof', async function () {

    const merkleTree = new SparseMerkleTree({
      5: sha3(Buffer.from("5")),
      4: sha3(Buffer.from("4")),
      2: sha3(Buffer.from("2")),
      1: sha3(Buffer.from("1"))
    }, 4);

    assert.isTrue(await plasma.verifyProof(merkleTree.getHexProofForIndex(0), merkleTree.getHexRoot(), "0x0", 0));
    assert.isTrue(await plasma.verifyProof(merkleTree.getHexProofForIndex(4), merkleTree.getHexRoot(), SparseMerkleTree.bufArrToHex([sha3(Buffer.from("4"))]), 4));
    assert.isTrue(await plasma.verifyProof(merkleTree.getHexProofForIndex(7), merkleTree.getHexRoot(), "0x0", 7));
  });
});
