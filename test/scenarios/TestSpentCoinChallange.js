import { assert } from 'chai';
import { BigNumber } from 'bignumber.js';
import PlasmaUser from '../lib/PlasmaUser';
import PlasmaOperator from '../lib/PlasmaOperator';
import { shortAddr } from '../helpers/privKeyGen';

const PlasmaCash = artifacts.require('PlasmaCash');
const ministroPlasmaUtil = require('../ministro-contracts/ministroPlasma');

const ministroPlasma = ministroPlasmaUtil();
const debug = 0;

let plasmaOperator;
let plasmaInstance;

let alice;
const aliceDeposit = 5;

let bob;
const bobDeposit = 5;

const challengeTimeoutSec = 7;


contract('Plasma Cash - Exit Spent Coin Challenge', async (accounts) => {
  beforeEach(async () => {
    plasmaInstance = await PlasmaCash.new(challengeTimeoutSec);
    ministroPlasma.setInstanceVar(plasmaInstance);
    await ministroPlasma.setOperator(accounts[0], true, { from: accounts[0] });

    plasmaOperator = new PlasmaOperator(accounts[0], ministroPlasma);

    alice = new PlasmaUser(accounts[1]);
    bob = new PlasmaUser(accounts[2]);

    plasmaOperator.setPlasmaCash(ministroPlasma);
    alice.setPlasmaCash(ministroPlasma);
    bob.setPlasmaCash(ministroPlasma);

    if (debug) console.log('bob:', shortAddr(bob.address));
    if (debug) console.log('alice:', shortAddr(alice.address));
  });

  describe('when alice and bob made deposit to Plasma Cash Contract', () => {
    beforeEach(async () => {
      await alice.depositETH(aliceDeposit);
      await bob.depositETH(bobDeposit);
    });

    it('users should have its UIDs', () => {
      assert.exists(bob.uids[0]);
      assert.exists(alice.uids[0]);
    });

    describe('when bob want to pay to alice with his token', async () => {
      let aliceNewToken;
      let bobTx;
      let poolId;
      let blockIndex;

      beforeEach(async () => {
        aliceNewToken = bob.uids[0];
        bobTx = await bob.sendPETH(aliceNewToken, alice, true);
      });

      describe('when alice has confirmation of spend UTXO transaction)', async () => {
        beforeEach(async () => {
          ({ poolId, blockIndex } = await plasmaOperator.submitSingleTx(bobTx));
        });

        describe('when bob want to exit with money he already spend', async () => {
          beforeEach(async () => {
            // bob is not longer owner of `bobUid` because he send it to Alice
            await ministroPlasma.startDepositExit(bob.uids[0], { from: bob.address });
          });

          it('bob exit should be on plasma contract', async () => {
            const { exitor, timestamp } = await ministroPlasma.exits(bob.uids[0]);
            assert.strictEqual(exitor.toString(), bob.address);
            assert.notStrictEqual(timestamp.toString(), '0');
          });

          describe('when bob want to exit with money he already spend', async () => {
            beforeEach(async () => {
              await ministroPlasma.startDepositExit(bob.uids[0], { from: bob.address }, true);
            });

            describe('when alice start deposit exit', async () => {
              beforeEach(async () => {
                await ministroPlasma.startDepositExit(alice.uids[0], { from: alice.address });
              });

              describe('when someone send challenge tx', async () => {
                let proof;
                let transactionBytes;
                let signature;


                beforeEach(async () => {
                  proof = plasmaOperator.getProof(poolId, aliceNewToken);
                  transactionBytes = plasmaOperator.getTxBytes(poolId, aliceNewToken);
                  signature = plasmaOperator.getTxSignature(poolId, aliceNewToken);


                  assert.isNotEmpty(proof, 'empty proof');
                  assert.isNotEmpty(blockIndex, 'empty blockIndex');
                  assert.isNotEmpty(transactionBytes, 'empty tx bytes');
                  assert.isNotEmpty(signature, 'empty signature');

                  await ministroPlasma.challengeDepositExit(
                    blockIndex,
                    transactionBytes,
                    proof,
                    signature,
                    { from: alice.address },
                  );
                });

                it('bob exit should be invalid', async () => {
                  const { exitor, timestamp, invalid } = await ministroPlasma.exits(bob.uids[0]);

                  assert.strictEqual(exitor, bob.address);
                  assert.isTrue(BigNumber(timestamp).gt(0));
                  assert.isTrue(invalid);
                });


                describe('when we wait for challenge Timeout pass', async () => {
                  beforeEach((done) => {
                    setTimeout(() => { done(); }, (challengeTimeoutSec + 1) * 1000);
                  });

                  describe('when somebody finalize exits', async () => {
                    beforeEach(async () => {
                      const res = await ministroPlasma.finalizeExits({ from: accounts[0] });
                      assert.exists(res.LogFinalizeExit);
                    });

                    it('alice deposit should be empty', async () => {
                      const { depositor, amount } = await ministroPlasma.deposits(aliceNewToken);

                      assert.strictEqual(parseInt(depositor, 10), 0);
                      assert.strictEqual(parseInt(amount, 10), 0);
                    });

                    it('alice balance should have value', async () => {
                      const balance = await ministroPlasma.balances(alice.address);
                      assert(BigNumber(balance).gt(0));
                    });

                    it('alice should be able to withdraw', async () => {
                      await ministroPlasma.withdraw({ from: alice.address });
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
