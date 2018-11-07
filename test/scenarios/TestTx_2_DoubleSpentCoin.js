import { BigNumber } from 'bignumber.js';
import { assert } from 'chai';
import {
  scenarioObjects, exitBond, challengeTimeoutSec, challengeTimeoutSecPass,
} from '../helpers/createScenarioObjects';
import { moveForward } from '../helpers/SpecHelper';

let ministroPlasma;
let plasmaOperator;

let users;
const usersDeposits = [10, 200, 3000];

contract('Plasma Cash', async (accounts) => {
  before(async () => {
    ({
      ministroPlasma,
      plasmaOperator,
      users,
    } = await scenarioObjects(accounts, usersDeposits.length));

    const awaits = [];
    usersDeposits.map((amount, index) => {
      awaits.push(users[index].depositETH(amount));
      return true;
    });
    await Promise.all(awaits);
  });


  describe('DOUBLE SPEND scenario', async () => {
    let spentNonce;

    before(async () => {
      spentNonce = users[0].getLastDepositNonce();
    });

    describe('when user#0 transfers token to user#1', async () => {
      let tx1;
      let tx2DoubleSpent;
      before(async () => {
        tx1 = await users[0].createUTXO(spentNonce, users[1]);

        await plasmaOperator.submitSingleTx(tx1);

        tx2DoubleSpent = await users[0].createUTXO(spentNonce, users[2]);
        users[0].transferNonceHistoryToNewOwner(spentNonce, users[1]);

        users.map((user) => {
          user.updateTokenHistoryAfterOperatorSubmitBlock(plasmaOperator);
          return true;
        });

        users[1].saveTxToHistory(spentNonce, tx1);
      });


      describe('DOUBLE SPEND: when user#0 transfers already spent token to user#2', async () => {
        before(async () => {
          // cheater uses history of current owner
          users[1].transferNonceHistoryToNewOwner(spentNonce, users[2]);

          await plasmaOperator.submitSingleTx(tx2DoubleSpent);

          users.map((user) => {
            user.updateTokenHistoryAfterOperatorSubmitBlock(plasmaOperator);
            return true;
          });

          users[2].saveTxToHistory(spentNonce, tx2DoubleSpent);
        });

        it('tx1 and t2 should have different target block, because they are for same deposit nonce', () => {
          assert.notStrictEqual(tx1.targetBlock, tx2DoubleSpent.targetBlock, 'invalid targe block');
        });


        describe('when user#2 notice double spent, but he want to steal deposit anyway', async () => {
          before(async () => {
            const { proof, tx } = users[2].getRootAndTxFromHistory(
              spentNonce,
              tx2DoubleSpent.targetBlock,
            );
            const transactionBytes = tx.toRLPHex();

            await ministroPlasma.startTxExit(
              transactionBytes,
              proof,
              tx.signature,
              users[0].address,
              { from: users[2].address, value: exitBond },
            );
          });

          describe('when user#1 noticed a problem after some time (but before challenge time pass)', async () => {
            const halfChallangeTime = Math.ceil(challengeTimeoutSec / 2);
            before(async () => {
              await moveForward(halfChallangeTime);
            });

            it('should be NOT possible to cancel user#2 exit with user#1 tx', async () => {
              const { proof, tx } = users[2].getRootAndTxFromHistory(spentNonce, tx1.targetBlock);
              const transactionBytes = tx.toRLPHex();

              await ministroPlasma.challengeExit(
                transactionBytes,
                proof,
                tx.signature,
                { from: users[1].address },
                true,
              );
            });

            it('user#1 can`t challenge user#2, he can only start its own exit', async () => {
              const { proof, tx } = users[2].getRootAndTxFromHistory(spentNonce, tx1.targetBlock);
              const transactionBytes = tx.toRLPHex();

              await ministroPlasma.startTxExit(
                transactionBytes,
                proof,
                tx.signature,
                users[0].address,
                { from: users[1].address, value: exitBond },
              );
            });


            describe('when challenge Timeout for user#2 pass', async () => {
              before(async () => {
                await moveForward(halfChallangeTime + 2);
              });

              describe('when we want to finalize exits on spent deposit', async () => {
                before(async () => {
                  const res = await ministroPlasma.finalizeExits(spentNonce, { from: accounts[0] });
                  assert.notExists(res.LogFinalizeExit, 'should be no final exits');
                });

                it('spent deposit should be there, because user#1 has priority before user#2', async () => {
                  const { owner, amount } = await ministroPlasma.deposits(spentNonce);

                  assert.strictEqual(owner, users[0].address, 'invalid deposit owner');
                  assert(BigNumber(amount).eq(usersDeposits[0]), 'missing deposit');
                });

                it('user#2 should have NO balance', async () => {
                  const balance = await ministroPlasma.balances(users[2].address);
                  assert.strictEqual(balance.toString(), '0', 'invalid user#2 balance');
                });

                it('user#1 should have NO balance', async () => {
                  const balance = await ministroPlasma.balances(users[1].address);
                  assert.strictEqual(balance.toString(), '0', 'invalid user#1 balance');
                });

                describe('when challenge Timeout for user#1 pass', async () => {
                  before(async () => {
                    await moveForward(challengeTimeoutSecPass);
                  });

                  describe('when we finalize exits on spent deposit', async () => {
                    before(async () => {
                      const res = await ministroPlasma.finalizeExits(
                        spentNonce,
                        { from: accounts[0] },
                      );
                      assert.strictEqual(res.LogFinalizeExit.length, 1, 'only user#1 exit should be there');
                    });

                    it('spent deposit should be empty', async () => {
                      const { owner, amount } = await ministroPlasma.deposits(spentNonce);

                      assert.strictEqual(parseInt(owner, 10), 0);
                      assert.strictEqual(parseInt(amount, 10), 0);
                    });

                    it('user#2 should have NO balance', async () => {
                      const balance = await ministroPlasma.balances(users[2].address);
                      assert.strictEqual(balance.toString(), '0', 'invalid user#2 balance');
                    });

                    it('user#1 should have balance', async () => {
                      const balance = await ministroPlasma.balances(users[1].address);
                      assert(BigNumber(exitBond)
                        .plus(usersDeposits[0]) // spent token was deposited by user#0
                        .eq(balance), 'invalid user#1 balance');
                    });

                    describe('after user#1 withdraw', async () => {
                      before(async () => {
                        await ministroPlasma.withdraw({ from: users[1].address });
                      });

                      it('user#2 balance should be 0', async () => {
                        const balance = await ministroPlasma.balances(users[1].address);
                        assert.strictEqual(balance.toString(10), '0', 'invalid balance');
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
});
