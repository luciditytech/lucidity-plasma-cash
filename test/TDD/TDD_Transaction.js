import { assert } from 'chai';
import { privGen, privToAddr } from '../helpers/privKeyGen';
import Transaction from '../lib/Transaction';

const Web3 = require('web3');

const web3 = new Web3(Web3.currentProvider || 'http://localhost:8545');

const PlasmaCash = artifacts.require('PlasmaCash');


contract('Transaction object', async (accounts) => {
  const prevBlock = 1;
  const uid = '0x1';
  let plasmaInstance;

  before(async () => {
    plasmaInstance = await PlasmaCash.new(60 * 60 * 24 * 7);
  });


  describe('TDD using ganache unlocked accounts', () => {
    const [sender, newOwner] = accounts;

    let tx;
    let tid;
    let signature;

    it('should allow to create tx object', async () => {
      tx = new Transaction(sender, uid, prevBlock, newOwner);
      assert.isObject(tx);
    });

    it('tx should have correct initial values', async () => {
      assert.strictEqual(tx.getSender(), sender, 'invalid sender');
      assert.strictEqual(tx.getNewOwner(), newOwner, 'invalid newOwner');
    });

    it('should be different tid for different transactions', async () => {
      const tx1 = new Transaction(sender, uid, prevBlock, newOwner);
      const tx2 = new Transaction(sender, uid, prevBlock + 1, newOwner);
      assert.notEqual(tx1.tidHex(), tx2.tidHex());
    });

    it('should NOT allow to change tx attributes', () => {
      ['uid', 'prevBlock', 'newOwner', 'sender'].map((k) => {
        const invalid = [];
        try {
          tx[k] = '123';
          invalid.push(k);
        } catch (e) {
          // pass
        }
        assert.isEmpty(invalid, 'some tx properties are writable');
        return true;
      });
    });

    it('should allow to create tid (hash of the transaction)', () => {
      tid = tx.tidHex();
      assert.isTrue(web3.utils.isHex(tid));
    });

    it('should allow to sign transaction with sender address', async () => {
      signature = await tx.sign();
      assert.isTrue(web3.utils.isHex(signature));
    });

    it('should have the same tx.tid value after tx had been sign', () => {
      assert.strictEqual(tid, tx.tidHex());
    });

    it('should save signature after tx is signed', () => {
      assert.strictEqual(signature, tx.signature);
    });

    it('should allow to verify signature', () => {
      assert.isTrue(tx.verify());
      assert.isTrue(tx.verify(sender));
    });

    it('should fail if address not match signature', () => {
      assert.isFalse(tx.verify(newOwner));
    });


    it('contract should be able to verify signature', async () => {
      assert.isTrue(await plasmaInstance.helperTestSig.call(sender, tx.tidHex(), tx.signature));
    });
  });

  describe('TDD using custom generated accounts', () => {
    let tx;
    let signature;
    const senderPrivKey = privGen();
    const newOwnerPrivKey = privGen();
    const sender = privToAddr(senderPrivKey);
    const newOwner = privToAddr(newOwnerPrivKey);


    it('should allow to create tx object with custom sender and custom new owner', async () => {
      tx = new Transaction(sender, uid, prevBlock, newOwner);
      assert.isObject(tx);
    });

    it('should allow to sign transaction using private key', () => {
      signature = tx.signByPrivKey(senderPrivKey);
      assert.isTrue(web3.utils.isHex(signature.toString('hex')));
      assert.notStrictEqual(parseInt(signature, 16), 0);
    });

    it('should allow to verify signature signed with private key', () => {
      assert.isTrue(tx.verifySignature(signature, sender));
    });

    it('should NOT allow to verify signature signed with private key when invalid address', () => {
      assert.isFalse(tx.verifySignature(signature, newOwner));
    });
  });
});
