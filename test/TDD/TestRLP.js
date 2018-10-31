import { expect } from 'chai';
import { BigNumber } from 'bignumber.js';

const RLP = require('rlp');

const encode = {
  'three arrays': { data: [[], [[]], [[], [[]]]], bytes: 'c7c0c1c0c3c0c1c0' },
  'empty array': { data: [], bytes: 'c0' },
  dog: { data: 'dog', bytes: '83646f67' },
  cat: { data: 'cat', bytes: '83636174' },
  '[[cat] & [dog]]': { data: ['cat', 'dog'], bytes: 'c88363617483646f67' },
  'empty string': { data: '', bytes: '80' },
  'int 0': { data: 0, bytes: '80' },
  'int 15': { data: 15, bytes: '0f' },
  'int 1024': { data: 1024, bytes: '820400' },
};

const decode = {
  dog: { data: 'dog', bytes: '0x83646f67' },
  cat: { data: 'cat', bytes: '0x83636174' },
  'empty string': { data: '', bytes: '0x80' },
  'int 0': { data: 0, bytes: '0x80' },
  'int 15': { data: 15, bytes: '0x0f' },
  'int 1024': { data: 1024, bytes: '0x820400' },
};


describe('RLP', () => {
  describe('Encode', () => {
    Object.keys(encode).map((key) => {
      it(`Encode ${key}`, () => {
        expect(RLP.encode(encode[key].data).toString('hex')).to.equal(encode[key].bytes);
      });
      return true;
    });
  });

  describe('Decode', () => {
    Object.keys(decode).map((key) => {
      it(`Decode ${key}`, () => {
        if (decode[key].data === 0) {
          expect(RLP.decode(decode[key].bytes).toString('hex')).to.equal('');
        } else if (typeof decode[key].data === 'string') {
          expect(RLP.decode(decode[key].bytes).toString('utf8')).to.equal(decode[key].data);
        } else if (typeof decode[key].data === 'number') {
          const hex = BigNumber(`0x${RLP.decode(decode[key].bytes).toString('hex')}`).toString(16);
          expect(hex).to.equal(decode[key].data.toString(16));
        }
      });
      return true;
    });
  });
});
