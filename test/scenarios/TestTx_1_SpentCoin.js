import { BigNumber } from 'bignumber.js';
import { assert } from 'chai';
import { scenarioObjects, exitBond, challengeTimeoutSecPass } from '../helpers/createScenarioObjects';
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


  describe('SPEND COIN SCENARIO on user#0 deposit', async () => {
    let spentDepositId;
    let blockIndex;

    before(async () => {
      spentDepositId = users[0].getLastDepositNonce();
    });

    describe('when user#0 transfers token to user#1', async () => {
      let tx1;
      before(async () => {
        tx1 = await users[0].createUTXO(spentDepositId, users[1]);
        users[0].transferNonceHistoryToNewOwner(spentDepositId, users[1]);

        ({ blockIndex } = await plasmaOperator.submitSingleTx(tx1));

        users.map((user) => {
          user.updateTokenHistoryAfterOperatorSubmitBlock(plasmaOperator);
          return true;
        });

        users[1].saveTxToHistory(spentDepositId, tx1);
      });

      it('tx user#0 => user#1 should has valid prev and target block', () => {
        assert(BigNumber(tx1.prevTxBlockIndex).eq(0), 'for 1st tx prev block should point to 0');
        assert(BigNumber(tx1.targetBlock).eq(blockIndex), 'for 1st tx target block should be 1');
      });

      it('user#0 should have NO history of spent deposit', () => {
        const res = users[0].getRootAndTxFromHistory(spentDepositId, blockIndex);
        assert.isNull(res, 'there should be no data');
      });

      it('user#1 should have history of spent deposit', () => {
        const { proof, tx } = users[1].getRootAndTxFromHistory(spentDepositId, blockIndex);
        assert.exists(proof, 'there should be a proof');
        assert.isObject(tx, 'there should be tx object');
      });

      describe('when user#1 transfers token to user#2', async () => {
        let tx2;
        before(async () => {
          tx2 = await users[1].createUTXO(spentDepositId, users[2]);
          users[1].transferNonceHistoryToNewOwner(spentDepositId, users[2]);

          ({ blockIndex } = await plasmaOperator.submitSingleTx(tx2));

          users.map((user) => {
            user.updateTokenHistoryAfterOperatorSubmitBlock(plasmaOperator);
            return true;
          });

          users[2].saveTxToHistory(spentDepositId, tx2);
        });


        it('tx user#1 => user#2 should has valid prev and target block', () => {
          assert(BigNumber(tx2.prevTxBlockIndex).eq(tx1.targetBlock), 'prev block should point to prev tx block');
          assert(BigNumber(tx2.targetBlock).eq(blockIndex), 'target block is invalid');
        });

        it('user#1 should have NO history of spent deposit', () => {
          const res = users[1].getRootAndTxFromHistory(spentDepositId, blockIndex);
          assert.isNull(res, 'there should be no data');
        });

        it('user#2 should have history of spent deposit', () => {
          const { proof, tx } = users[2].getRootAndTxFromHistory(spentDepositId, blockIndex);
          assert.exists(proof, 'there should be a proof');
          assert.isObject(tx, 'there should be tx object');
        });

        it('user#1 can NOT start exit tx without bond value', async () => {
          const { proof, tx } = users[2].getRootAndTxFromHistory(spentDepositId, tx1.targetBlock);
          const transactionBytes = tx.toRLPHex();

          await ministroPlasma.startTxExit(
            transactionBytes,
            proof,
            tx.signature,
            tx.sender,
            { from: users[1].address, value: 0 },
            true,
          );
        });

        describe('when user#2 is current deposit owner and user#1 start exit on spent deposit', async () => {
          before(async () => {
            const { proof, tx } = users[2].getRootAndTxFromHistory(spentDepositId, tx1.targetBlock);

            const transactionBytes = tx.toRLPHex();

            await ministroPlasma.startTxExit(
              transactionBytes,
              proof,
              tx.signature,
              users[0].address,
              { from: users[1].address, value: exitBond },
            );
          });

          describe('when user#2 challenge user#1 exit', async () => {
            before(async () => {
              const { proof, tx } = users[2].getRootAndTxFromHistory(
                spentDepositId,
                tx2.targetBlock,
              );
              const transactionBytes = tx.toRLPHex();

              await ministroPlasma.challengeExit(
                transactionBytes,
                proof,
                tx.signature,
                { from: users[2].address },
              );
            });

            describe('when user#2 start tx exit on his new token', async () => {
              before(async () => {
                const { proof, tx } = users[2].getRootAndTxFromHistory(
                  spentDepositId,
                  tx2.targetBlock,
                );
                const transactionBytes = tx.toRLPHex();

                await ministroPlasma.startTxExit(
                  transactionBytes,
                  proof,
                  tx.signature,
                  users[1].address,
                  { from: users[2].address, value: exitBond },
                );
              });

              it('should be NOT possible to cancel user#2 exit with its own tx', async () => {
                const { proof, tx } = users[2].getRootAndTxFromHistory(
                  spentDepositId,
                  tx2.targetBlock,
                );
                const transactionBytes = tx.toRLPHex();

                await ministroPlasma.challengeExit(
                  transactionBytes,
                  proof,
                  tx.signature,
                  { from: users[1].address },
                  true,
                );
              });

              it('should be NOT possible to cancel user#2 exit with old tx', async () => {
                const { proof, tx } = users[2].getRootAndTxFromHistory(
                  spentDepositId,
                  tx1.targetBlock,
                );
                const transactionBytes = tx.toRLPHex();

                await ministroPlasma.challengeExit(
                  transactionBytes,
                  proof,
                  tx.signature,
                  { from: users[1].address },
                  true,
                );
              });


              describe('when challenge timeout DID NOT pass', async () => {
                it('tx exit can NOT be finalize', async () => {
                  const res = await ministroPlasma.finalizeExits(
                    spentDepositId,
                    { from: accounts[0] },
                    false,
                  );
                  assert.notExists(res.LogFinalizeExit, 'no way!');
                });
              });


              describe('when challenge Timeout pass', async () => {
                before(async () => {
                  await moveForward(challengeTimeoutSecPass);
                });

                it('user#2 exit should have priority', async () => {
                  const priority = await ministroPlasma.getExitQueue(spentDepositId, 0);

                  assert(BigNumber(priority).eq(tx2.targetBlock), 'invalid priority');
                });

                it('spent deposit should be secure and exist', async () => {
                  const { owner, amount } = await ministroPlasma.deposits(spentDepositId);

                  assert.strictEqual(owner, users[0].address, 'invalid owner');
                  assert(BigNumber(amount).eq(usersDeposits[0]), 'invalid amount');
                });

                describe('when we finalize exit for spent deposit', async () => {
                  before(async () => {
                    const res = await ministroPlasma.finalizeExits(
                      spentDepositId,
                      { from: accounts[0] },
                    );
                    assert.exists(res.LogFinalizeExit, 'should be final');
                  });

                  it('spent deposit should be empty', async () => {
                    const { owner, amount } = await ministroPlasma.deposits(spentDepositId);

                    assert.strictEqual(parseInt(owner, 10), 0);
                    assert.strictEqual(parseInt(amount, 10), 0);
                  });

                  it('user#0 should have NO balance', async () => {
                    const balance = await ministroPlasma.balances(users[0].address);
                    assert.strictEqual(balance.toString(), '0', 'invalid user#0 balance');
                  });
                  it('user#1 should have NO balance', async () => {
                    const balance = await ministroPlasma.balances(users[1].address);
                    assert.strictEqual(balance.toString(), '0', 'invalid user#1 balance');
                  });

                  it('user#2 should have balance', async () => {
                    const balance = await ministroPlasma.balances(users[2].address);
                    assert(BigNumber(exitBond)
                      .plus(usersDeposits[0]) // spent token was depositet by user#0
                      .plus(exitBond) // challenge prize
                      .eq(balance), 'invalid user#2 balance');
                  });

                  describe('after user#2 withdraw', async () => {
                    before(async () => {
                      await ministroPlasma.withdraw({ from: users[2].address });
                    });

                    it('user#2 balance should be 0', async () => {
                      const balance = await ministroPlasma.balances(users[2].address);
                      assert.strictEqual(balance.toString(10), '0', 'bob just did not exit');
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
