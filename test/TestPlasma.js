const ethjsUtil = require('ethereumjs-util');
const secp256k1 = require('secp256k1');
const crypto = require('crypto');
const BigNumber = require('bignumber.js');

const Transaction = require('../js/lib/Transaction');
const SparseMerkleTree = require('../js/lib/SparseMerkleTree');

const { sha3, sha256, bufferToHex } = require('ethereumjs-util');

const Plasma = artifacts.require('./Plasma.sol');

const privKey = new Buffer('c87509a1c067bbde78beb793e6fa76530b6382a4c0241e5e4a9ec0a0f44dc0d3', 'hex');

contract('Plasma', async ([owner]) => {
  it('check balance', async function () {
    assert.isTrue((await web3.eth.getBalance(owner) > 1.0));
  });

  let plasma;
  it('create contract', async function () {
    plasma = await Plasma.new(-1);
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

    depositTransaction1 = new Transaction('0x' + depositEvent.args.uid.toString(16), 0, depositEvent.args.depositor);

    assert.equal(depositEvent.args.amount, amount);
  });

  let depositTransaction2;
  it('deposit 2', async function () {
    const amount = 1000000;

    const depositRes = (await plasma.deposit('0x0', amount, {
      value: amount,
    }));

    const depositEvent = depositRes.logs.find(x => x.event === 'Deposit');

    depositTransaction2 = new Transaction('0x' + depositEvent.args.uid.toString(16), 0, depositEvent.args.depositor);

    assert.equal(depositEvent.args.amount, amount);
  });

  let depositTransaction3;
  it('deposit 3', async function () {
    const amount = 1000000;

    const depositRes = (await plasma.deposit('0x0', amount, {
      value: amount,
    }));

    const depositEvent = depositRes.logs.find(x => x.event === 'Deposit');

    depositTransaction3 = new Transaction('0x' + depositEvent.args.uid.toString(16), 0, depositEvent.args.depositor);

    assert.equal(depositEvent.args.amount, amount);
  });

  it('submit block', async function () {

    const txs = {};
    txs[depositTransaction1.getUID()] = depositTransaction1.tid();
    txs[depositTransaction2.getUID()] = depositTransaction2.tid();
    txs[depositTransaction3.getUID()] = depositTransaction3.tid();

    const merkleTree = new SparseMerkleTree(txs);

    const submitRes = (await plasma.submitBlock(merkleTree.getHexRoot(), 0));

    const submitEvent = submitRes.logs.find(x => x.event === 'BlockSubmitted');

    assert.equal(submitEvent.args.blockIndex, 0);
    assert.equal(submitEvent.args.merkleRoot, merkleTree.getHexRoot());

    // prove existence
    const proof1 = merkleTree.getHexProofForIndex(depositTransaction1.getUID());
    assert.isTrue(await plasma.proveTX(0, depositTransaction1.toRLPHex(), proof1));

    // prove non-existence
    const proof2 = merkleTree.getHexProofForIndex(3);
    assert.isTrue(await plasma.proveNoTX(0, 3, proof2));
  });

  it('withdrawDeposit 1', async function () {
    const withdrawDepositRes = (await plasma.withdrawDeposit(0));

    const withdrawDepositEvent = withdrawDepositRes.logs.find(x => x.event === 'WithdrawDeposit');

    assert.equal(withdrawDepositEvent.args.uid.toString(16), new BigNumber(depositTransaction1.getUID()).toString(16));
    assert.equal(withdrawDepositEvent.args.depositor, depositTransaction1.getNewOwner());

    assert.isDefined(withdrawDepositRes.logs.find(x => x.event === 'ExitStarted').args.priority);
  });

  it('withdrawDeposit 1 failure', async function () {
    try {
      await plasma.withdrawDeposit(0);
      assert.fail();
    } catch (err) {
      assert.isTrue(err.message.includes('VM Exception'));
    }
  });

  it('withdrawDeposit 2', async function () {
    const withdrawDepositRes = (await plasma.withdrawDeposit(1));

    const withdrawDepositEvent = withdrawDepositRes.logs.find(x => x.event === 'WithdrawDeposit');

    assert.equal(withdrawDepositEvent.args.uid.toString(16), new BigNumber(depositTransaction2.getUID()).toString(16));
    assert.equal(withdrawDepositEvent.args.depositor, depositTransaction2.getNewOwner());

    assert.isDefined(withdrawDepositRes.logs.find(x => x.event === 'ExitStarted').args.priority);
  });

  it('next exit', async function () {
    const [uid, timestamp] = await plasma.getNextExit();

    assert.equal(uid.toString(16), new BigNumber(depositTransaction1.getUID()).toString(16));
  });

  it('finalize', async function () {
    const finalizeExitsRes = await plasma.finalizeExits();

    assert.equal(2, finalizeExitsRes.logs.length);
  });

  it('next exit 3', async function () {
    try {
      await plasma.getNextExit();
      assert.fail();
    } catch (err) {
      assert.isTrue(err.message.includes('VM Exception'));
    }
  });

  let changeOwnerTransaction3;
  it('submit block (change ownership)', async function () {

    changeOwnerTransaction3 = new Transaction(depositTransaction3.getUID(), 0, '0x0');

    const txs = {};
    txs[changeOwnerTransaction3.getUID()] = changeOwnerTransaction3.tid();

    const merkleTree = new SparseMerkleTree(txs);

    const submitRes = (await plasma.submitBlock(merkleTree.getHexRoot(), 1));

    const submitEvent = submitRes.logs.find(x => x.event === 'BlockSubmitted');

    assert.equal(submitEvent.args.blockIndex, 1);
    assert.equal(submitEvent.args.merkleRoot, merkleTree.getHexRoot());
  });

  it('withdrawDeposit 3', async function () {
    const withdrawDepositRes = (await plasma.withdrawDeposit(2));

    const withdrawDepositEvent = withdrawDepositRes.logs.find(x => x.event === 'WithdrawDeposit');

    assert.equal(withdrawDepositEvent.args.uid.toString(16), new BigNumber(depositTransaction3.getUID()).toString(16));

    assert.isDefined(withdrawDepositRes.logs.find(x => x.event === 'ExitStarted').args.priority);
  });

  it('challenge 3', async function () {

    const txs = {};
    txs[changeOwnerTransaction3.getUID()] = changeOwnerTransaction3.tid();

    const merkleTree = new SparseMerkleTree(txs);
    const proof = merkleTree.getHexProofForIndex(changeOwnerTransaction3.getUID());

    const challengeWithdrawDepositRes = (await plasma.challengeWithdrawDeposit(1, changeOwnerTransaction3.toRLPHex(), proof, changeOwnerTransaction3.signHex(privKey)));

    const depositWithdrawChallengedEvent = challengeWithdrawDepositRes.logs.find(x => x.event === 'DepositWithdrawChallenged');

    assert.equal(depositWithdrawChallengedEvent.args.uid.toString(16), new BigNumber(changeOwnerTransaction3.getUID()).toString(16));
  });

  it('finalize', async function () {
    const finalizeExitsRes = await plasma.finalizeExits();

    assert.equal(0, finalizeExitsRes.logs.length);
  });

  it('next exit 4', async function () {
    try {
      await plasma.getNextExit();
      assert.fail();
    } catch (err) {
      assert.isTrue(err.message.includes('VM Exception'));
    }
  });

  it('withdrawDeposit 1 failure 2', async function () {
    try {
      await plasma.withdrawDeposit(0);
      assert.fail();
    } catch (err) {
      assert.isTrue(err.message.includes('VM Exception'));
    }
  });

  it('withdrawDeposit 3 failure', async function () {
    try {
      await plasma.withdrawDeposit(0);
      assert.fail();
    } catch (err) {
      assert.isTrue(err.message.includes('VM Exception'));
    }
  });
});
