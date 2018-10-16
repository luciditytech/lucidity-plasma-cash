import { BigNumber } from 'bignumber.js';
import { assert } from 'chai';
import { proxyExecute } from '../ministro-utils';

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
      assert(BigNumber(block.timestamp).minus(Date.now()).lt(60), 'block timeout is older that 60seconds, and it was just submitted');
    }

    return results;
  };


  app.deposit = async (currency, amount2send, txAttr, expectThrow) => {
    const txAttrLocal = app.getTxAttr(txAttr);
    const action = () => app.instance.deposit(currency, amount2send, txAttrLocal);

    const results = await app.executeAction(action, txAttrLocal, 1, 'LogDeposit', expectThrow);

    if (!expectThrow) {
      assert.exists(results.LogDeposit, 'missing LogDeposit event');
      const [deposited] = results.LogDeposit;

      assert.strictEqual(deposited.depositor, txAttr.from, 'invalid depositor');

      const { depositor, amount } = await app.deposits(deposited.uid.toString(10));

      assert.strictEqual(deposited.depositor, depositor, 'invalid depositor');
      assert.strictEqual(deposited.amount.toString(10), amount, 'invalid amount');
    }

    return results;
  };

  app.startDepositExit = async (uid, txAttr, expectThrow) => {
    const txAttrLocal = app.getTxAttr(txAttr);
    const action = () => app.instance.startDepositExit(uid, txAttrLocal);

    const results = await app.executeAction(action, txAttrLocal, null, null, expectThrow);

    if (!expectThrow) {
      assert.exists(results.ExitStarted, 'missing ExitStarted event');
      const [{ priority }] = results.ExitStarted;

      assert(BigNumber(priority).gt(0), 'priority is empty');

      assert.exists(results.LogStartDepositExit, 'missing LogStartDepositExit event');
      const [startDepositExit] = results.LogStartDepositExit;

      const { exitor, timestamp, invalid } = await app.exits(startDepositExit.uid.toString(10));

      assert.strictEqual(exitor, startDepositExit.depositor, 'invalid depositor/exitor');
      assert(BigNumber(timestamp).gt(0), 'invalid timestamp');
      assert.isFalse(invalid, 'invalid should be false');
    }

    return results;
  };


  app.finalizeExits = async (txAttr, expectThrow) => {
    const txAttrLocal = app.getTxAttr(txAttr);
    const action = () => app.instance.finalizeExits(txAttrLocal);

    const results = await app.executeAction(action, txAttrLocal, null, null, expectThrow);

    if (!expectThrow) {
      assert(!results.LogFinalizeExit ? !results.LogAddBalance : !!results.LogAddBalance, 'there should be both or none events');
      if (!results.LogFinalizeExit) return results;

      assert.strictEqual(results.LogFinalizeExit.length, results.LogAddBalance.length, 'we should have equal count of events');


      results.LogFinalizeExit.map(async (finalizedExit, i) => {
        const {
          depositor, amount, uid, exitTimestamp,
        } = finalizedExit;
        const logAddBalance = results.LogAddBalance[i];

        assert.strictEqual(depositor, logAddBalance.receiver, 'invalid depositor/receiver');
        assert.strictEqual(amount.toString(10), logAddBalance.amount.toString(10), 'invalid amount');
        assert(BigNumber(exitTimestamp).lte(Date.now()), 'invalid exitTimestamp');

        const exit = await app.exits(uid.toString(10));
        assert.strictEqual(parseInt(exit.exitor, 10), 0, 'exitor should be deleted');
        assert.strictEqual(parseInt(exit.timestamp, 10), 0, 'timestamp should be deleted');
        assert.isFalse(exit.invalid, 'invalid invalid :)');

        const deposit = await app.deposits(uid.toString(10));
        assert.strictEqual(parseInt(deposit.depositor, 10), 0, 'depositor should be deleted');
        assert.strictEqual(parseInt(deposit.amount, 10), 0, 'amount should be deleted');
      });
    }

    return results;
  };

  app.challengeDepositExit = async (
    blockIndex,
    transactionBytes,
    proof,
    signature,
    txAttr,
    expectThrow,
  ) => {
    const txAttrLocal = app.getTxAttr(txAttr);
    const action = () => app.instance.challengeDepositExit(
      blockIndex, transactionBytes, proof, signature, txAttrLocal,
    );

    const results = await app.executeAction(
      action, txAttrLocal, 1, 'LogChallengeDepositExit', expectThrow,
    );

    if (!expectThrow) {
      const [LogChallengeDepositExit] = results.LogChallengeDepositExit;

      assert(BigNumber(LogChallengeDepositExit.blockIndex).eq(blockIndex), 'invalid blockIndex');
      assert.strictEqual(LogChallengeDepositExit.challenger, txAttrLocal.from, 'invalid challenger');

      const { invalid } = await app.exits(LogChallengeDepositExit.uid.toString(10));
      assert(invalid, 'exit should be invalid after challange');
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

  app.blockCount = async () => app.instance.blockCount.call();
  app.operators = async addr => app.instance.operators.call(addr);

  app.exits = async (uid) => {
    const res = await app.instance.exits.call(uid);
    return {
      exitor: res[0],
      timestamp: res[1].toString(10),
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


  app.deposits = async (uid) => {
    const res = await app.instance.deposits.call(uid);
    return {
      depositor: res[0],
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
