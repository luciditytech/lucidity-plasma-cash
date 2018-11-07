import { BigNumber } from 'bignumber.js';
import { assert } from 'chai';
import { proxyExecute } from '../ministro-utils';
import { bothOrNone, CurrentTimestamp } from '../helpers/binary';
import Transaction from '../lib/Transaction';


// const Web3 = require('web3');
// let web3 = new Web3(Web3.currentProvider || 'http://localhost:8545');


function ministroContract() {
  const app = {};


  /* eslint-disable-next-line */
  app.__proto__ = proxyExecute();


  app.submitBlock = async (merkleRoot, blockIndex, txAttr, expectThrow) => {
    const txAttrLocal = app.getTxAttr(txAttr);
    const action = () => app.instance.submitBlock(merkleRoot, blockIndex, txAttrLocal);

    const results = await app.executeAction(action, txAttrLocal, 1, 'LogSubmitBlock', expectThrow);

    if (!expectThrow) {
      const [blockSubmitted] = results.LogSubmitBlock;

      assert.strictEqual(blockSubmitted.blockIndex.toString(10), blockIndex.toString(10), 'invalid blockIndex');
      assert.strictEqual(blockSubmitted.operator, txAttrLocal.from, 'invalid sender/operator');
      assert.strictEqual(blockSubmitted.merkleRoot, merkleRoot, 'invalid merkleRoot');

      const block = await app.blocks(blockSubmitted.blockIndex.toString(10));

      assert.strictEqual(blockSubmitted.merkleRoot, block.merkleRoot, 'merkleRoot on blockchain is different');
      assert(BigNumber(block.timestamp).gt(0), 'block timestamp is empty');
    }

    return results;
  };


  app.deposit = async (currency, amount2send, txAttr, expectThrow) => {
    const txAttrLocal = app.getTxAttr(txAttr);
    const action = () => app.instance.deposit(currency, amount2send, txAttrLocal);

    const results = await app.executeAction(action, txAttrLocal, 1, 'LogDeposit', expectThrow);

    if (!expectThrow) {
      assert.exists(results.LogDeposit, 'missing LogDeposit event');
      const [{ depositOwner, depositId, depositAmount }] = results.LogDeposit;

      assert.strictEqual(depositOwner, txAttrLocal.from, 'invalid deposit owner');
      assert(BigNumber(depositAmount).eq(amount2send), 'invalid deposit amount');

      const { owner, amount } = await app.deposits(depositId);

      assert.strictEqual(owner, depositOwner, 'invalid owner/depositOwner');
      assert(BigNumber(amount).eq(depositAmount), 'invalid depositAmount');
    }

    return results;
  };

  app.startDepositExit = async (depNonce, txAttr, expectThrow) => {
    const currTimestamp = CurrentTimestamp();

    const txAttrLocal = app.getTxAttr(txAttr);
    const action = () => app.instance.startDepositExit(depNonce, txAttrLocal);

    const prevBalance = expectThrow ? null : await app.balances(txAttrLocal.from);

    const results = await app.executeAction(action, txAttrLocal, null, null, expectThrow);

    if (!expectThrow) {
      await app.assertStartExit(results, depNonce, 0, txAttrLocal, currTimestamp);

      app.assertExitBond(results, txAttrLocal, prevBalance);
    }

    return results;
  };


  app.assertStartExit = async (results, depNonce, blkIndex, txAttrLocal, timeBeforeTx) => {
    assert.exists(results.LogStartExit, 'missing LogStartExit event');

    const [{
      executor, depositId, blockIndex, finalizeTime,
    }] = results.LogStartExit;

    assert.strictEqual(executor, txAttrLocal.from, 'invalid executor');
    assert(BigNumber(depositId).eq(depNonce), 'invalid deposit nonce');
    assert(BigNumber(blockIndex).eq(blkIndex), 'invalid blkIndex');
    assert(BigNumber(finalizeTime).gt(timeBeforeTx), 'invalid finalizeTime');

    const {
      exitor, finalAt, invalid,
    } = await app.exits(depositId, blockIndex);

    assert.strictEqual(exitor, txAttrLocal.from, 'invalid exitor');
    assert(BigNumber(finalAt).eq(finalizeTime), 'invalid finalAt/finalizeTime');
    assert.isFalse(invalid, 'exit should be valid');
  };


  app.assertExitBond = async (results, txAttrLocal, prevBalance) => {
    const exitBond = await app.exitBond();
    if (BigNumber(txAttrLocal.value).gt(exitBond)) {
      assert.exists(results.LogAddBalance, 'missing LogAddBalance event');
      const [{ receiver, amount }] = results.LogAddBalance;

      assert(BigNumber(txAttrLocal.value).minus(exitBond).eq(amount), 'invalid change from value');
      assert.strictEqual(receiver, txAttrLocal.from, 'executor should get price');

      const balance = await app.balances(txAttrLocal.from);
      assert(BigNumber(prevBalance).plus(amount).eq(balance), 'invalid balance after exit');
    }
  };

  app.startTxExit = async (
    txBytes,
    proof,
    signature,
    spender,
    txAttr,
    expectThrow,
  ) => {
    const currTimestamp = CurrentTimestamp();

    const txAttrLocal = app.getTxAttr(txAttr);
    const action = () => app.instance.startTxExit(
      txBytes,
      proof,
      signature,
      spender,
      txAttrLocal,
    );

    const prevBalance = expectThrow ? null : await app.balances(txAttrLocal.from);

    const results = await app.executeAction(action, txAttrLocal, null, null, expectThrow);

    if (!expectThrow) {
      const tx = Transaction.fromRLP(txBytes);

      await app.assertStartExit(
        results,
        tx.depositId,
        tx.targetBlock,
        txAttrLocal,
        currTimestamp,
      );

      app.assertExitBond(results, txAttrLocal, prevBalance);
    }

    return results;
  };


  app.challengeExit = async (
    transactionBytes,
    proof,
    signature,
    txAttr,
    expectThrow,
  ) => {
    const txAttrLocal = app.getTxAttr(txAttr);
    const action = () => app.instance.challengeExit(
      transactionBytes, proof, signature, txAttrLocal,
    );

    const prevBalance = expectThrow ? null : await app.balances(txAttrLocal.from);

    const results = await app.executeAction(action, txAttrLocal, null, null, expectThrow);

    if (!expectThrow) {
      assert.exists(results.LogChallengeExit, 'missing LogChallengeExit event');
      const [{ challenger, depositId, blockIndex }] = results.LogChallengeExit;

      assert.strictEqual(challenger, txAttrLocal.from, 'invalid challenger');

      const tx = Transaction.fromRLP(transactionBytes);

      assert(BigNumber(tx.depositId).eq(depositId), 'invalid depositId');
      assert(BigNumber(tx.prevTxBlockIndex).eq(blockIndex), 'invalid prevTxBlockIndex/blockIndex');

      const exit = await app.exits(depositId, blockIndex);
      assert(exit.invalid, 'exit should be invalid after challenge');

      assert.exists(results.LogAddBalance, 'missing LogAddBalance event');
      const [{ receiver, amount }] = results.LogAddBalance;

      const exitBond = await app.exitBond();
      assert(BigNumber(amount).eq(exitBond), 'invalid amount/exitBond');
      assert.strictEqual(receiver, txAttrLocal.from, 'executor should get price/balance');

      const balance = await app.balances(txAttrLocal.from);
      assert(BigNumber(prevBalance).plus(exitBond).eq(balance), 'invalid balance after challenge');
    }

    return results;
  };

  app.finalizeExits = async (depNonce, txAttr, expectThrow) => {
    const txAttrLocal = app.getTxAttr(txAttr);
    const action = () => app.instance.finalizeExits(depNonce, txAttrLocal);

    const results = await app.executeAction(action, txAttrLocal, null, null, expectThrow);

    if (!expectThrow) {
      assert.strictEqual(bothOrNone(results.LogFinalizeExit, results.LogAddBalance), 0, 'there should be both or none');
      if (!results.LogFinalizeExit) return results;

      assert.strictEqual(results.LogFinalizeExit.length, results.LogAddBalance.length, 'we should have equal count of events');

      results.LogFinalizeExit.map(async (finalizedExit, i) => {
        const {
          exitor, amount, depositId, blockIndex,
        } = finalizedExit;

        const logAddBalance = results.LogAddBalance[i];

        assert.strictEqual(exitor, logAddBalance.receiver, 'invalid exitor/receiver');
        assert(BigNumber(amount).eq(logAddBalance.amount), 'invalid amount');

        const exit = await app.exits(depositId, blockIndex);
        assert(BigNumber(exit.exitor).eq(0), 'exitor should be deleted');
        assert(BigNumber(exit.finalAt).eq(0), 'timestamp should be deleted');
        assert.isFalse(exit.invalid, 'invalid invalid :)');

        const deposit = await app.deposits(depositId);
        assert(BigNumber(deposit.owner).eq(0), 'owner should be deleted');
        assert(BigNumber(deposit.amount).eq(0), 'amount should be empty');
      });
    }

    return results;
  };


  app.setOperator = async (operator, operatorStatus, txAttr, expectThrow) => {
    const txAttrLocal = app.getTxAttr(txAttr);
    const action = () => app.instance.setOperator(operator, operatorStatus, txAttrLocal);

    const results = await app.executeAction(action, txAttrLocal, null, null, expectThrow);

    if (!expectThrow) {
      const status = await app.operators(operator);
      assert.isTrue(status === operatorStatus, 'invalid operator_status');
    }

    return results;
  };


  app.withdraw = async (txAttr, expectThrow) => {
    // TODO check user balance before and after

    // let balance = expectThrow ? null : await web3.eth.getBalance(txAttr.from);

    const txAttrLocal = app.getTxAttr(txAttr);
    const action = () => app.instance.withdraw(txAttrLocal);

    const results = await app.executeAction(action, txAttrLocal, null, null, expectThrow);

    if (!expectThrow) {
      assert.exists(results.LogWithdraw, 'missing LogWithdraw event');
      const [withdraw] = results.LogWithdraw;

      const currentBalance = await app.balances(withdraw.executor);
      assert.strictEqual(parseInt(currentBalance, 10), 0, 'after withdraw balance should be 0');
    }

    return results;
  };

  app.depositId = async () => app.instance.depositId.call();
  app.exitBond = async () => app.instance.exitBond.call();
  app.chainBlockIndex = async () => app.instance.chainBlockIndex.call();
  app.operators = async addr => app.instance.operators.call(addr);

  app.getExitQueue = async (depositId, index) => app.instance.exitQueue.call(
    BigNumber(depositId).toString(10),
    BigNumber(index).toString(10),
  );

  app.exits = async (depositId, blockIndex) => {
    const res = await app.instance.exits.call(
      BigNumber(depositId).toString(10),
      BigNumber(blockIndex).toString(10),
    );
    return {
      exitor: res[0],
      finalAt: res[1].toString(10),
      invalid: res[2],
    };
  };

  app.txsExits = async (nonce) => {
    const res = await app.instance.txsExits.call(BigNumber(nonce).toString(10));
    return {
      exitor: res[0],
      finalAt: res[1].toString(10),
      invalid: res[2],
    };
  };

  app.blocks = async (id) => {
    const res = await app.instance.blocks.call(id);
    return {
      merkleRoot: res[0],
      timestamp: res[1].toString(10),
    };
  };


  app.deposits = async (depositId) => {
    const res = await app.instance.deposits.call(BigNumber(depositId).toString(10));
    return {
      owner: res[0],
      amount: res[1].toString(10),
    };
  };

  app.balances = async (address) => {
    const res = await app.instance.balances.call(address);
    return res.toString(10);
  };


  return app;
}

module.exports = ministroContract;
