const ethjsUtil = require('ethereumjs-util');
const secp256k1 = require('secp256k1');
const crypto = require('crypto');

const Transaction = require('../js/lib/Transaction');
const SparseMerkleTree = require('../js/lib/SparseMerkleTree');

const { sha3, sha256, bufferToHex } = require('ethereumjs-util');

const Plasma = artifacts.require('./Plasma.sol');

contract('Plasma', async ([owner]) => {

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

  let depositTransaction1;
  it('deposit 1', async function () {
    const amount = 1000000;

    const depositRes = (await plasma.deposit('0x0', amount, {
      value: amount,
    }));

    const depositEvent = depositRes.logs.find(x => x.event === 'Deposit');

    depositTransaction1 = new Transaction(depositEvent.args._uid, 0, depositEvent.args._depositor);

    assert.equal(depositEvent.args._amount, amount);
  });

  let depositTransaction2;
  it('deposit 2', async function () {
    const amount = 1000000;

    const depositRes = (await plasma.deposit('0x0', amount, {
      value: amount,
    }));

    const depositEvent = depositRes.logs.find(x => x.event === 'Deposit');

    depositTransaction2 = new Transaction(depositEvent.args._uid, 0, depositEvent.args._depositor);

    assert.equal(depositEvent.args._amount, amount);
  });

  it('submit block', async function () {

    const txs = {};
    txs[depositTransaction1.getUID()] = depositTransaction1.tid();

    const merkleTree = new SparseMerkleTree(txs);

    const submitRes = (await plasma.submitBlock(merkleTree.getHexRoot(), 1));

    const submitEvent = submitRes.logs.find(x => x.event === 'BlockSubmitted');

    assert.equal(submitEvent.args._blockIndex, 1);
    assert.equal(submitEvent.args._merkleRoot, merkleTree.getHexRoot());

    // prove existence
    const proof1 = merkleTree.getHexProofForIndex(depositTransaction1.getUID());
    assert.isTrue(await plasma.proveTX(1, depositTransaction1.toRLPHex(), proof1));

    // prove non-existence
    const proof2 = merkleTree.getHexProofForIndex(0);
    assert.isTrue(await plasma.proveNoTX(1, 0, proof2));
  });

  it('withdrawDeposit 1', async function () {
    const withdrawDepositRes = (await plasma.withdrawDeposit(0, '0x0'));

    const withdrawDepositEvent = withdrawDepositRes.logs.find(x => x.event === 'WithdrawDeposit');

    assert.equal(withdrawDepositEvent.args._uid, depositTransaction1.getUID());
    assert.equal(withdrawDepositEvent.args._depositIndex, 0);

    const exitStartedEvent = withdrawDepositRes.logs.find(x => x.event === 'ExitStarted');
  });

  it('withdrawDeposit 1 failure', async function () {
    try {
      await plasma.withdrawDeposit(0, '0x0');
      assert.fail();
    } catch (err) {
      assert.isTrue(err.message.includes('VM Exception'));
    }
  });

  it('withdrawDeposit 2', async function () {
    const withdrawDepositRes = (await plasma.withdrawDeposit(1, '0x0'));

    const withdrawDepositEvent = withdrawDepositRes.logs.find(x => x.event === 'WithdrawDeposit');

    assert.equal(withdrawDepositEvent.args._uid, depositTransaction2.getUID());
    assert.equal(withdrawDepositEvent.args._depositIndex, 1);

    const exitStartedEvent = withdrawDepositRes.logs.find(x => x.event === 'ExitStarted');
  });

  it('next exit', async function () {
    const [depositIndex, uid, timestamp] = await plasma.getNextExit();

    assert.equal(depositIndex.toString(16), '0');
    assert.equal(uid, depositTransaction1.getUID());
    console.log(timestamp);
  });
});
