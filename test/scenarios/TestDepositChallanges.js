import { assert } from 'chai';
import { BigNumber } from 'bignumber.js';
import { scenarioObjects, challengeTimeoutSecPass, exitBond } from '../helpers/createScenarioObjects';
import { changeOneRandomData } from '../helpers/binary';
import { moveForward } from '../helpers/SpecHelper';


let ministroPlasma;
let plasmaOperator;

let alice;
const aliceDeposit = 5;
let aliceNonce;

let bob;
const bobDeposit = 20;
let bobSpentNonce;


contract('Plasma Cash - Deposits scenario', async (accounts) => {
  before(async () => {
    let users;

    ({ ministroPlasma, plasmaOperator, users } = await scenarioObjects(accounts, 2));

    alice = users[0];
    bob = users[1];
  });


  describe('there should be valid initial values', async () => {
    it('balances of users should be 0', async () => {
      const bobBalance = await ministroPlasma.balances(bob.address);
      assert.strictEqual(bobBalance.toString(10), '0');
      const aliceBalance = await ministroPlasma.balances(alice.address);
      assert.strictEqual(aliceBalance.toString(10), '0');
    });

    it('deposit nonce should be 0', async () => {
      const n = await ministroPlasma.depositId();
      assert.strictEqual(n.toString(10), '0');
    });

    it('chain block index should be 1', async () => {
      const blockIndex = await ministroPlasma.chainBlockIndex();
      assert.strictEqual(blockIndex.toString(10), '1');
    });
  });

  describe('when alice and bob made deposit to Plasma Cash Contract', async () => {
    before(async () => {
      await alice.depositETH(aliceDeposit);
      await bob.depositETH(bobDeposit);

      aliceNonce = alice.getLastDepositNonce();
    });

    it('users should have depositIds', () => {
      assert.strictEqual(Object.keys(alice.depositsNonces).length, 1, 'there should be one nonce');
      assert.strictEqual(Object.keys(bob.depositsNonces).length, 1, 'there should be one nonce');
    });

    it('bob can NOT start deposit exit without bond value', async () => {
      await ministroPlasma.startDepositExit(
        bob.getLastDepositNonce(),
        { from: bob.address, value: 0 },
        true,
      );
    });

    it('bob can NOT start deposit exit with not enough bond value', async () => {
      await ministroPlasma.startDepositExit(
        bob.getLastDepositNonce(),
        { from: bob.address, value: (exitBond - 1) },
        true,
      );
    });

    it('bob can NOT start deposit exit on alice deposit', async () => {
      await ministroPlasma.startDepositExit(
        aliceNonce,
        { from: bob.address, value: exitBond },
        true,
      );
    });

    it('alice can start deposit exit on her deposit nonce', async () => {
      await ministroPlasma.startDepositExit(
        aliceNonce,
        { from: alice.address, value: exitBond },
      );
    });

    it('bob can NOT start deposit exit on non existed deposit', async () => {
      await ministroPlasma.startDepositExit(999, { from: bob.address, value: 0 }, true);
    });

    // TODO can we sent PETH to ourself?

    describe('when bob transfer ownership to alice', async () => {
      let bobTx;
      let blockIndex;
      let proof;

      before(async () => {
        bobSpentNonce = bob.getLastDepositNonce();
        bobTx = await bob.createUTXO(bobSpentNonce, alice);

        bob.transferNonceHistoryToNewOwner(bobSpentNonce, alice);
      });

      describe('when alice has confirmation of spend UTXO', async () => {
        before(async () => {
          ({ blockIndex } = await plasmaOperator.submitSingleTx(bobTx));
          alice.updateTokenHistoryAfterOperatorSubmitBlock(plasmaOperator);
          bob.updateTokenHistoryAfterOperatorSubmitBlock(plasmaOperator);

          alice.saveTxToHistory(bobSpentNonce, bobTx);
        });

        it('bob can start deposit exit on spent deposit', async () => {
          await ministroPlasma.startDepositExit(
            bobSpentNonce,
            { from: bob.address, value: exitBond },
          );
        });

        it('bob can NOT start deposit exit twice', async () => {
          await ministroPlasma.startDepositExit(
            bobSpentNonce,
            { from: bob.address, value: exitBond },
            true,
          );
        });

        // TODO make more tx and test challenge with not direct Tx

        // TODO check if anyone else can start exit on this depositId

        describe('when we have all data to make exit deposit challenge', async () => {
          let transactionBytes;
          let tx;

          before(async () => {
            ({ proof, tx } = alice.getRootAndTxFromHistory(bobSpentNonce, blockIndex));
            transactionBytes = tx.toRLPHex();

            assert.isNotEmpty(proof, 'empty proof');
            assert.isNotEmpty(transactionBytes, 'empty tx bytes');
            assert.isNotEmpty(tx.signature, 'empty signature');
          });

          describe('when we want to challenge exit deposit with invalid data', async () => {
            it('can NOT challenge with invalid tx bytes', async () => {
              await ministroPlasma.challengeExit(
                changeOneRandomData(transactionBytes, 2),
                proof,
                tx.signature,
                tx.targetBlock,
                { from: alice.address },
                true,
              );
            });

            it('can NOT challenge with invalid proof', async () => {
              // be careful with changing proof, this is a lot of bytes and it may take
              // a lot of time if you completely randomize the change
              await ministroPlasma.challengeExit(
                transactionBytes,
                changeOneRandomData(proof, 16, 1),
                tx.signature,
                tx.targetBlock,
                { from: alice.address },
                true,
              );
            });

            it('can NOT challenge with invalid signature', async () => {
              await ministroPlasma.challengeExit(
                transactionBytes,
                proof,
                changeOneRandomData(tx.signature, 2),
                tx.targetBlock,
                { from: alice.address },
                true,
              );
            });
          });

          describe('when someone send valid challenge for exit deposit', async () => {
            before(async () => {
              const res = await ministroPlasma.challengeExit(
                transactionBytes,
                proof,
                tx.signature,
                { from: alice.address },
              );
              assert.exists(res.LogChallengeExit);
            });

            it('bob deposit exit should be invalid', async () => {
              const exit = await ministroPlasma.exits(bobSpentNonce, 0);
              assert(exit.invalid, 'oops, exit should be invalid');
            });

            it('bob can NOT start new exit after challenge', async () => {
              await ministroPlasma.startDepositExit(
                bobSpentNonce,
                { from: bob.address, value: exitBond },
                true,
              );
            });

            // TODO:alice can NOT start exit Tx on token from bob, because bob has exit in progress

            describe('when challenge timeout DID NOT pass', async () => {
              it('alice valid deposit exit can NOT be finalize', async () => {
                const res = await ministroPlasma.finalizeExits(aliceNonce, { from: accounts[0] });
                assert.notExists(res.LogFinalizeExit, 'no way!');
              });

              it('bob invalid exit can NOT be finalize', async () => {
                const res = await ministroPlasma.finalizeExits(
                  bobSpentNonce,
                  { from: accounts[0] },
                );
                assert.notExists(res.LogFinalizeExit, 'no way!');
              });
            });

            describe('when challenge Timeout pass', async () => {
              before(async () => {
                await moveForward(challengeTimeoutSecPass);
              });

              describe('when somebody finalize exits on alice deposit', async () => {
                before(async () => {
                  const res = await ministroPlasma.finalizeExits(aliceNonce, { from: accounts[0] });
                  assert.strictEqual(res.LogFinalizeExit.length, 1, 'only alice exit should be there');
                });

                it('alice deposit should be empty', async () => {
                  const { owner, amount } = await ministroPlasma.deposits(aliceNonce);

                  assert.strictEqual(parseInt(owner, 10), 0);
                  assert.strictEqual(parseInt(amount, 10), 0);
                });

                it('alice new token (spent by bob) should exist', async () => {
                  const { owner, amount } = await ministroPlasma.deposits(bobSpentNonce);

                  assert.strictEqual(owner, bob.address);
                  assert.strictEqual(amount.toString(10), bobDeposit.toString(10));
                });

                it('alice should have valid balance amount', async () => {
                  const balance = await ministroPlasma.balances(alice.address);
                  assert(BigNumber(exitBond)
                    .plus(aliceDeposit)
                    .plus(exitBond) // challenge prize
                    .eq(balance), 'invalid balance');
                });

                it('alice should be able to withdraw', async () => {
                  await ministroPlasma.withdraw({ from: alice.address });
                });

                it('bob balance should be 0', async () => {
                  const balance = await ministroPlasma.balances(bob.address);
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
