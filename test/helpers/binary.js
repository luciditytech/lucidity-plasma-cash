import { BigNumber } from 'bignumber.js';

const binaryPrefix = '0b';
const hexPrefix = '0x';


const shiftLeft = (number, bits) => {
  if (bits <= 0 || bits >= 256) {
    throw new Error(`${bits} not supported`);
  }

  return binaryPrefix + BigNumber(number).toString(2) + '0'.repeat(bits);
};

const shiftRight = (number, bits) => {
  if (bits <= 0 || bits >= 256) {
    throw new Error(`${bits} not supported`);
  }

  const shiftRes = BigNumber(number).toString(2).slice(0, -bits);
  return binaryPrefix + (shiftRes === '' ? '0' : shiftRes);
};

const binaryOr = (a, b) => {
  if (typeof a === 'undefined') {
    throw new Error('[binaryOr] a is undefined');
  }
  if (typeof b === 'undefined') {
    throw new Error('[binaryOr] b is undefined');
  }

  let a2 = BigNumber(a).toString(2);
  let b2 = BigNumber(b).toString(2);
  const d = Math.abs(a2.length - b2.length);

  if (BigNumber(a2).gt(b2)) {
    b2 = '0'.repeat(d) + b2;
  } else {
    a2 = '0'.repeat(d) + a2;
  }


  let result = '';
  for (let i = 0; i < a2.length; i += 1) {
    result += (a2[i] === '1' || b2[i] === '1' ? '1' : '0');
  }

  return binaryPrefix + result;
};

const bothOrNone = (a, b) => {
  const boolA = !!a;
  const boolB = !!b;
  const valid = boolA ? boolB : !boolB;
  if (valid) return 0;
  return !a ? 'no A but B is present' : 'A present, but B missing';
};


const changeOneRandomData = (data, metric, changeCharAt) => {
  if (![2, 10, 16].includes(metric)) {
    throw new Error(`metric ${metric} not supported`);
  }

  let prefix = '';
  if (metric === 2) prefix = binaryPrefix;
  else if (metric === 16) prefix = hexPrefix;

  let metricData = BigNumber(data).toString(metric);
  const x = changeCharAt !== 'undefined' ? changeCharAt : Math.floor(Math.random() * (metricData.length - 1));
  metricData = metricData.slice(0, x - 1)
    + ((parseInt(metricData[x], metric) + 1) % metric)
    + metricData.slice(x + 1);

  return BigNumber(prefix + metricData).toString(10);
};


const CurrentTimestamp = () => Math.round(new Date().getTime() / 1000);

export {
  shiftLeft,
  shiftRight,
  binaryOr,
  bothOrNone,
  binaryPrefix,
  changeOneRandomData,
  CurrentTimestamp,
};
