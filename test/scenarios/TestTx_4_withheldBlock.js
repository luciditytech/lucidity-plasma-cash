import { BigNumber } from 'bignumber.js';
import { assert } from 'chai';
import { scenarioObjects, exitBond, challengeTimeoutSecPass } from '../helpers/createScenarioObjects';
import { moveForward } from '../helpers/SpecHelper';

let ministroPlasma;
let plasmaOperator;

let users;
const usersDeposits = [1, 2, 4, 8];
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


  describe('WITHHELD BLOCK scenario', async () => {
    let spentNonce;

    before(async () => {
      spentNonce = users[0].getLastDepositNonce();
    });

    describe('tx#0: transfer user#0 => user#1', async () => {
      before(async () => {
        txs.push(await users[0].createUTXO(spentNonce, users[1]));
        await plasmaOperator.submitSingleTx(txs[0]);
        users[0].transferNonceHistoryToNewOwner(spentNonce, users[1]);
        users.map((user) => {
          user.updateTokenHistoryAfterOperatorSubmitBlock(plasmaOperator);
          return true;
        });
        users[1].saveTxToHistory(spentNonce, txs[0]);
      });

      describe('WITHHELD BLOCK: tx#1: transfer user#1 => user#2 (no submit block)', async () => {
        before(async () => {
          txs.push(await users[1].createUTXO(spentNonce, users[2]));

          // await plasmaOperator.submitSingleTx(txs[1]);

          users[1].transferNonceHistoryToNewOwner(spentNonce, users[2]);

          users.map((user) => {
            user.updateTokenHistoryAfterOperatorSubmitBlock(plasmaOperator);
            return true;
          });

          users[2].saveTxToHistory(spentNonce, txs[1]);
        });

        describe('tx#2: transfer user#2 => user#3', async () => {
          before(async () => {
            txs.push(await users[2].createUTXO(spentNonce, users[3]));

            await plasmaOperator.submitSingleTx(txs[2]);

            users[2].transferNonceHistoryToNewOwner(spentNonce, users[3]);

            users.map((user) => {
              user.updateTokenHistoryAfterOperatorSubmitBlock(plasmaOperator);
              return true;
            });

            users[3].saveTxToHistory(spentNonce, txs[2]);
          });

          it('last user should have history of all transactions (including withholded)', async () => {
            assert.strictEqual(txs.length, 3, 'invalid history length');
            assert.strictEqual(users[3].depositsNonces[spentNonce].history.length, txs.length, 'invalid history length');
          });


          it('user#3 should NOT be able to start exits because prevTxBlockIndex will not match', async () => {
            const { proof, tx } = users[3].getRootAndTxFromHistory(spentNonce, txs[2].targetBlock);
            const transactionBytes = tx.toRLPHex();

            await ministroPlasma.startTxExit(
              transactionBytes,
              proof,
              tx.signature,
              tx.sender,
              { from: users[3].address, value: exitBond },
              true,
            );
          });

          describe('when valid owner (user#1) start exit on last valid tx', async () => {
            before(async () => {
              const { proof, tx } = users[3].getRootAndTxFromHistory(
                spentNonce,
                txs[0].targetBlock,
              );
              const transactionBytes = tx.toRLPHex();

              await ministroPlasma.startTxExit(
                transactionBytes,
                proof,
                tx.signature,
                tx.sender,
                { from: users[1].address, value: exitBond },
              );
            });


            it('user#2 should NOT be able to cancel user#1 exit, because tx#1 is not on blockchain', async () => {
              const { proof, tx } = users[3].getRootAndTxFromHistory(
                spentNonce,
                txs[1].targetBlock,
              );
              const transactionBytes = tx.toRLPHex();

              await ministroPlasma.challengeExit(
                transactionBytes,
                proof,
                tx.signature,
                { from: users[2].address },
                true,
              );
            });


            describe('when challenge Timeout pass for both exits (no challenges)', async () => {
              before(async () => {
                await moveForward(challengeTimeoutSecPass);
              });

              describe('when we finalize exits on spent deposit', async () => {
                before(async () => {
                  const res = await ministroPlasma.finalizeExits(spentNonce, { from: accounts[0] });
                  assert.strictEqual(res.LogFinalizeExit.length, 1, 'should be only one valid exit');
                  assert(BigNumber(res.LogFinalizeExit[0].blockIndex).eq(txs[0].targetBlock), 'exit should be done for tx#0');
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

                it('user#1 should have balance', async () => {
                  const balance = await ministroPlasma.balances(users[1].address);
                  assert(BigNumber(exitBond)
                    .plus(usersDeposits[0]) // spent token was deposited by user#0
                    .eq(balance), 'invalid user#1 balance');
                });

                it('user#2 should have NO balance', async () => { await noBalance(2); });
                it('user#3 should have NO balance', async () => { await noBalance(3); });
              });
            });
          });
        });
      });
    });
  });
});
