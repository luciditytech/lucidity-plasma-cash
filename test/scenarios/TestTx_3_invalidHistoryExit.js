import { BigNumber } from 'bignumber.js';
import { assert } from 'chai';
import { scenarioObjects, exitBond, challengeTimeoutSec } from '../helpers/createScenarioObjects';
import { moveForward } from '../helpers/SpecHelper';

let ministroPlasma;
let plasmaOperator;

let users;
const usersDeposits = [1, 2, 4, 8, 16, 32, 64];
const txs = [];

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


  describe('EXIT WITH INVALID HISTORY on user#0 deposit', async () => {
    let spentNonce;
    let blockIndex;

    before(async () => {
      spentNonce = users[0].getLastDepositNonce();
    });

    describe('tx#0: transfer user#0 => user#1', async () => {
      before(async () => {
        txs.push(await users[0].createUTXO(spentNonce, users[1]));

        ({ blockIndex } = await plasmaOperator.submitSingleTx(txs[0]));

        users[0].transferNonceHistoryToNewOwner(spentNonce, users[1]);

        users.map((user) => {
          user.updateTokenHistoryAfterOperatorSubmitBlock(plasmaOperator);
          return true;
        });

        users[1].saveTxToHistory(spentNonce, txs[0]);
      });

      it('tx#0 target block should be valid', () => {
        assert(BigNumber(txs[0].getTargetBlock()).eq(blockIndex), 'invalid targetBlock');
      });

      it('tx#0 previous tx block index should be valid', () => {
        assert(BigNumber(blockIndex).minus(1).eq(txs[0].getPrevBlock()), 'invalid prevTxBlockIndex');
      });

      describe('tx#1: transfer user#1 => user#2', async () => {
        before(async () => {
          txs.push(await users[1].createUTXO(spentNonce, users[2]));

          ({ blockIndex } = await plasmaOperator.submitSingleTx(txs[1]));

          users[1].transferNonceHistoryToNewOwner(spentNonce, users[2]);

          users.map((user) => {
            user.updateTokenHistoryAfterOperatorSubmitBlock(plasmaOperator);
            return true;
          });

          users[2].saveTxToHistory(spentNonce, txs[1]);
        });

        it('tx#1 target block should be valid', () => {
          assert(BigNumber(txs[1].targetBlock).eq(blockIndex), 'invalid targetBlock');
        });

        it('tx#1 previous tx block index should be valid', () => {
          assert(BigNumber(blockIndex).minus(1).eq(txs[1].prevTxBlockIndex), 'invalid prevTxBlockIndex');
        });


        describe('INVALID HISTORY BLOCK tx#2: transfer user#2 => user#3 by operator', async () => {
          before(async () => {
            // history of token is public, so anybody can have it
            users[2].transferNonceHistoryToNewOwner(spentNonce, plasmaOperator);
            txs.push(await plasmaOperator.createUTXO(spentNonce, users[3]));

            plasmaOperator.transferNonceHistoryToNewOwner(spentNonce, users[3]);

            ({ blockIndex } = await plasmaOperator.submitSingleTx(txs[2]));

            users.map((user) => {
              user.updateTokenHistoryAfterOperatorSubmitBlock(plasmaOperator);
              return true;
            });

            users[3].saveTxToHistory(spentNonce, txs[2]);
          });

          it('tx#2 target block should be valid', () => {
            assert(BigNumber(txs[2].targetBlock).eq(blockIndex), 'invalid targetBlock');
          });

          it('tx#2 previous tx block index should be valid', () => {
            assert(BigNumber(blockIndex).minus(1).eq(txs[2].prevTxBlockIndex), 'invalid prevTxBlockIndex');
          });

          describe('tx#3: transfer user#3 => user#4', async () => {
            before(async () => {
              txs.push(await users[3].createUTXO(spentNonce, users[4]));

              ({ blockIndex } = await plasmaOperator.submitSingleTx(txs[3]));

              users[3].transferNonceHistoryToNewOwner(spentNonce, users[4]);

              users.map((user) => {
                user.updateTokenHistoryAfterOperatorSubmitBlock(plasmaOperator);
                return true;
              });

              users[4].saveTxToHistory(spentNonce, txs[3]);
            });

            it('tx#3 target block should be valid', () => {
              assert(BigNumber(txs[3].targetBlock).eq(blockIndex), 'invalid targetBlock');
            });

            it('tx#3 previous tx block index should be valid', () => {
              assert(BigNumber(blockIndex).minus(1).eq(txs[3].prevTxBlockIndex), 'invalid prevTxBlockIndex');
            });

            describe('tx#4: transfer user#4 => user#5', async () => {
              before(async () => {
                txs.push(await users[4].createUTXO(spentNonce, users[5]));

                ({ blockIndex } = await plasmaOperator.submitSingleTx(txs[4]));

                users[4].transferNonceHistoryToNewOwner(spentNonce, users[5]);

                users.map((user) => {
                  user.updateTokenHistoryAfterOperatorSubmitBlock(plasmaOperator);
                  return true;
                });

                users[5].saveTxToHistory(spentNonce, txs[4]);
              });

              it('tx#4 target block should be valid', () => {
                assert(BigNumber(txs[4].targetBlock).eq(blockIndex), 'invalid targetBlock');
              });

              it('tx#4 previous tx block index should be valid', () => {
                assert(BigNumber(blockIndex).minus(1).eq(txs[4].prevTxBlockIndex), 'invalid prevTxBlockIndex');
              });


              describe('when users start exits with invalid transactions', async () => {
                it('history should have 5 transactions', async () => {
                  assert.strictEqual(users[5].depositsNonces[spentNonce].history.length, 5, 'invalid history length');
                });

                async function userCanStartExit(i) {
                  const txId = i - 1;

                  const { proof, tx } = users[5].getRootAndTxFromHistory(
                    spentNonce,
                    txs[txId].targetBlock,
                  );
                  const transactionBytes = tx.toRLPHex();

                  await ministroPlasma.startTxExit(
                    transactionBytes,
                    proof,
                    tx.signature,
                    tx.sender,
                    { from: users[i].address, value: exitBond },
                  );
                }

                it('user#5 can start exit on invalid tx#4', async () => {
                  await userCanStartExit(5);
                });
                it('user#4 can start exit on invalid tx#3', async () => {
                  await userCanStartExit(4);
                });
                it('user#3 can start exit on invalid tx#2', async () => {
                  await userCanStartExit(3);
                });

                describe('when user#2 start exit on last valid transaction tx#1', async () => {
                  before(async () => {
                    const { proof, tx } = users[5].getRootAndTxFromHistory(
                      spentNonce,
                      txs[1].targetBlock,
                    );
                    const transactionBytes = tx.toRLPHex();

                    await ministroPlasma.startTxExit(
                      transactionBytes,
                      proof,
                      tx.signature,
                      tx.sender,
                      { from: users[2].address, value: exitBond },
                    );
                  });

                  it('operator should NOT be able to challenge user#2 valid exit with invalid tx#2', async () => {
                    const { proof, tx } = users[5].getRootAndTxFromHistory(
                      spentNonce,
                      txs[2].targetBlock,
                    );
                    const transactionBytes = tx.toRLPHex();

                    await ministroPlasma.challengeExit(
                      transactionBytes,
                      proof,
                      tx.signature,
                      { from: plasmaOperator.address },
                      true,
                    );
                  });

                  describe('when challenge Timeout pass', async () => {
                    before(async () => {
                      await moveForward(challengeTimeoutSec + 2);
                    });


                    describe('when we finalize exits on spent deposit', async () => {
                      before(async () => {
                        const res = await ministroPlasma.finalizeExits(
                          spentNonce,
                          { from: accounts[0] },
                        );
                        assert.strictEqual(res.LogFinalizeExit.length, 1, 'should be only one valid exit');
                        assert(BigNumber(res.LogFinalizeExit[0].blockIndex).eq(txs[1].targetBlock), 'exit should be done for tx#1');
                      });

                      it('spent deposit should be empty', async () => {
                        const { owner, amount } = await ministroPlasma.deposits(spentNonce);

                        assert.strictEqual(parseInt(owner, 10), 0);
                        assert.strictEqual(parseInt(amount, 10), 0);
                      });


                      async function noBalance(i) {
                        const balance = await ministroPlasma.balances(users[i].address);
                        assert.strictEqual(balance.toString(), '0', `invalid user#${i} balance`);
                      }

                      it('user#0 should have NO balance', async () => { await noBalance(0); });
                      it('user#1 should have NO balance', async () => { await noBalance(1); });

                      it('user#2 should have balance', async () => {
                        const balance = await ministroPlasma.balances(users[2].address);
                        assert(BigNumber(exitBond)
                          .plus(usersDeposits[0]) // spent token was deposited by user#0
                          .eq(balance), 'invalid user#2 balance');
                      });

                      it('user#3 should have NO balance', async () => { await noBalance(3); });
                      it('user#4 should have NO balance', async () => { await noBalance(4); });
                      it('user#5 should have NO balance', async () => { await noBalance(5); });
                      it('user#6 should have NO balance', async () => { await noBalance(6); });
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
