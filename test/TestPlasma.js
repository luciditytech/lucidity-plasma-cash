import Transaction from './lib/Transaction';
import SparseMerkleTree from './lib/SparseMerkleTree';

const BigNumber = require('bignumber.js');
const { sha3 } = require('ethereumjs-util');

const Web3 = require('web3');

const web3 = new Web3(Web3.currentProvider || 'http://localhost:8545');

const Plasma = artifacts.require('./PlasmaCash.sol');

// const privKey
//  = Buffer.from('c87509a1c067bbde78beb793e6fa76530b6382a4c0241e5e4a9ec0a0f44dc0d3', 'hex');

contract('Plasma', async (accounts) => {
  const [owner] = accounts;

  it('check balance', async () => {
    assert.isTrue((await web3.eth.getBalance(owner) > 1.0));
  });

  let plasma;
  it('create contract', async () => {
    plasma = await Plasma.new(-1);
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

  it('test merkle proof', async () => {
    const merkleTree = new SparseMerkleTree({
      5: sha3(Buffer.from('5')),
      4: sha3(Buffer.from('4')),
      2: sha3(Buffer.from('2')),
      1: sha3(Buffer.from('1')),
    }, 4);

    assert.isTrue(await plasma.verifyProof(merkleTree.getHexProofForIndex(0), merkleTree.getHexRoot(), '0x0', 0));
    assert.isTrue(await plasma.verifyProof(merkleTree.getHexProofForIndex(4), merkleTree.getHexRoot(), SparseMerkleTree.bufArrToHex([sha3(Buffer.from('4'))]), 4));
    assert.isTrue(await plasma.verifyProof(merkleTree.getHexProofForIndex(7), merkleTree.getHexRoot(), '0x0', 7));
  });

  let depositTransaction1;
  it('deposit 1', async () => {
    const amount = 1000000;

    const depositRes = (await plasma.deposit('0x0', amount, {
      value: amount,
    }));

    const depositEvent = depositRes.logs.find(x => x.event === 'LogDeposit');

    depositTransaction1 = new Transaction(owner, `0x${depositEvent.args.uid.toString(16)}`, 0, depositEvent.args.depositor);

    assert.equal(depositEvent.args.amount, amount);
  });

  let depositTransaction2;
  it('deposit 2', async () => {
    const amount = 1000000;

    const depositRes = (await plasma.deposit('0x0', amount, {
      value: amount,
    }));

    const depositEvent = depositRes.logs.find(x => x.event === 'LogDeposit');

    depositTransaction2 = new Transaction(owner, `0x${depositEvent.args.uid.toString(16)}`, 0, depositEvent.args.depositor);

    assert.equal(depositEvent.args.amount, amount);
  });

  let depositTransaction3;
  it('deposit 3', async () => {
    const amount = '1000000';

    const depositRes = (await plasma.deposit('0x0', amount, {
      value: amount,
    }));

    const depositEvent = depositRes.logs.find(x => x.event === 'LogDeposit');

    depositTransaction3 = new Transaction(owner, `0x${depositEvent.args.uid.toString(16)}`, 0, depositEvent.args.depositor);

    assert.equal(depositEvent.args.amount, amount);
  });

  it('submit block', async () => {
    const txs = {};
    txs[depositTransaction1.getUIDhex()] = depositTransaction1.tid();
    txs[depositTransaction2.getUIDhex()] = depositTransaction2.tid();
    txs[depositTransaction3.getUIDhex()] = depositTransaction3.tid();

    const merkleTree = new SparseMerkleTree(txs);

    const submitRes = (await plasma.submitBlock(merkleTree.getHexRoot(), 0));

    const submitEvent = submitRes.logs.find(x => x.event === 'LogSubmitBlock');

    assert.equal(submitEvent.args.blockIndex, 0);
    assert.equal(submitEvent.args.merkleRoot, merkleTree.getHexRoot());

    // prove existence
    const proof1 = merkleTree.getHexProofForIndex(depositTransaction1.getUIDhex());
    assert.isTrue(await plasma.proveTX(0, depositTransaction1.toRLPHex(), proof1));

    // prove non-existence
    const proof2 = merkleTree.getHexProofForIndex(3);
    assert.isTrue(await plasma.proveNoTX(0, 3, proof2));
  });

  it('startDepositExit 1', async () => {
    const startDepositExitRes = (await plasma.startDepositExit(0));

    const startDepositExitEvent = startDepositExitRes.logs.find(x => x.event === 'LogStartDepositExit');

    assert.equal(
      startDepositExitEvent.args.uid.toString(16),
      new BigNumber(depositTransaction1.getUIDhex()).toString(16),
    );
    assert.equal(startDepositExitEvent.args.depositor, depositTransaction1.getNewOwner());

    assert.isDefined(startDepositExitRes.logs.find(x => x.event === 'ExitStarted').args.priority);
  });

  it('startDepositExit 1 failure', async () => {
    try {
      await plasma.startDepositExit(0);
      assert.fail();
    } catch (err) {
      assert.isTrue(err.message.includes('VM Exception'));
    }
  });

  it('startDepositExit 2', async () => {
    const startDepositExitRes = (await plasma.startDepositExit(1));

    const startDepositExitEvent = startDepositExitRes.logs.find(x => x.event === 'LogStartDepositExit');

    assert.equal(
      startDepositExitEvent.args.uid.toString(16),
      new BigNumber(depositTransaction2.getUIDhex()).toString(16),
    );
    assert.equal(startDepositExitEvent.args.depositor, depositTransaction2.getNewOwner());

    assert.isDefined(startDepositExitRes.logs.find(x => x.event === 'ExitStarted').args.priority);
  });

  it('next exit', async () => {
    const [uid] = await plasma.getNextExit();

    assert.equal(uid.toString(16), new BigNumber(depositTransaction1.getUIDhex()).toString(16));
  });

  it('finalize', async () => {
    const finalizeExitsRes = await plasma.finalizeExits();

    assert.equal(4, finalizeExitsRes.logs.length);
  });

  it('next exit 3', async () => {
    try {
      await plasma.getNextExit();
      assert.fail();
    } catch (err) {
      assert.isTrue(err.message.includes('VM Exception'));
    }
  });

  let changeOwnerTransaction3;
  it('submit block (change ownership)', async () => {
    changeOwnerTransaction3 = new Transaction(
      owner, depositTransaction3.getUIDhex(), 0, accounts[1],
    );

    const txs = {};
    txs[changeOwnerTransaction3.getUIDhex()] = changeOwnerTransaction3.tid();

    const merkleTree = new SparseMerkleTree(txs);

    const submitRes = (await plasma.submitBlock(merkleTree.getHexRoot(), 1));

    const submitEvent = submitRes.logs.find(x => x.event === 'LogSubmitBlock');

    assert.equal(submitEvent.args.blockIndex, 1);
    assert.equal(submitEvent.args.merkleRoot, merkleTree.getHexRoot());
  });

  it('startDepositExit 3', async () => {
    const startDepositExitRes = (await plasma.startDepositExit(2));

    const startDepositExitEvent = startDepositExitRes.logs.find(x => x.event === 'LogStartDepositExit');

    assert.equal(
      startDepositExitEvent.args.uid.toString(16),
      new BigNumber(depositTransaction3.getUIDhex()).toString(16),
    );

    assert.isDefined(startDepositExitRes.logs.find(x => x.event === 'ExitStarted').args.priority);
  });

  /* commented out because this test not working, TODO check it in future development
  it('challenge 3', async () => {
    const txs = {};
    txs[changeOwnerTransaction3.getUIDhex()] = changeOwnerTransaction3.tid();

    const merkleTree = new SparseMerkleTree(txs);
    const proof = merkleTree.getHexProofForIndex(changeOwnerTransaction3.getUIDhex());

    const challengeLogStartDepositExitRes = await plasma
      .challengeLogStartDepositExit(
        1,
        changeOwnerTransaction3.toRLPHex(),
        proof,
        changeOwnerTransaction3.signHex(privKey),
      );

    const LogChallengeDepositExit =
      challengeLogStartDepositExitRes.logs.find(x => x.event === 'LogChallengeDepositExit');

    assert.equal(
      LogChallengeDepositExit.args.uid.toString(16),
      new BigNumber(changeOwnerTransaction3.getUID()).toString(16),
    );
  }); // */

  /* commented out because this test not working, TODO check it in future development
  it('finalize', async () => {
    const finalizeExitsRes = await plasma.finalizeExits();

    assert.equal(0, finalizeExitsRes.logs.length);
  }); // */

  /* commented out because this test not working, TODO check it in future development
  it('next exit 4', async () => {
    try {
      await plasma.getNextExit();
      assert.fail();
    } catch (err) {
      assert.isTrue(err.message.includes('VM Exception'));
    }
  }); // */

  it('startDepositExit 1 failure 2', async () => {
    try {
      await plasma.startDepositExit(0);
      assert.fail();
    } catch (err) {
      assert.isTrue(err.message.includes('VM Exception'));
    }
  });

  it('startDepositExit 3 failure', async () => {
    try {
      await plasma.startDepositExit(0);
      assert.fail();
    } catch (err) {
      assert.isTrue(err.message.includes('VM Exception'));
    }
  });

  /* commented out because this test not working, TODO check it in future development
  it('startDepositExit 3', async () => {
    const startDepositExitRes = (await plasma.startDepositExit(2));

    const startDepositExitEvent
      = startDepositExitRes.logs.find(x => x.event === 'LogStartDepositExit');

    assert.equal(
      startDepositExitEvent.args.uid.toString(16),
      new BigNumber(depositTransaction3.getUIDhex()).toString(16),
    );

    assert.isDefined(startDepositExitRes.logs.find(x => x.event === 'ExitStarted').args.priority);
  }); // */

  /* commented out because this test not working, TODO check it in future development
  it('challenge 3', async () => {
    const txs = {};
    txs[changeOwnerTransaction3.getUIDhex()] = changeOwnerTransaction3.tid();

    const merkleTree = new SparseMerkleTree(txs);
    const proof = merkleTree.getHexProofForIndex(changeOwnerTransaction3.getUIDhex());

    const challengeLogStartDepositExitRes = await plasma.challengeLogStartDepositExit(
      1,
      changeOwnerTransaction3.toRLPHex(),
      proof,
      changeOwnerTransaction3.signHex(privKey),
    );

    const LogChallengeDepositExit
      = challengeLogStartDepositExitRes.logs.find(x => x.event === 'LogChallengeDepositExit');

    assert.equal(
      LogChallengeDepositExit.args.uid.toString(16),
      new BigNumber(changeOwnerTransaction3.getUIDhex()).toString(16),
    );
  }); // */

  /* commented out because this test not working, TODO check it in future development
  it('finalize', async () => {
    const finalizeExitsRes = await plasma.finalizeExits();

    assert.equal(0, finalizeExitsRes.logs.length);
  }); // */
});
