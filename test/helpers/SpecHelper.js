const moveChar = () => {
  const rand = parseInt(Math.random() * 10, 10) % 4;
  switch (rand) {
    case 0: return '|';
    case 1: return '/';
    case 2: return '-';
    case 3: return '\\';
    default: return rand;
  }
};

const writeProcessMsg = (msg, useMoveChar = true) => {
  const lineLength = 118;
  const s = useMoveChar ? msg + moveChar() : msg;
  const spaces = lineLength - s.length > 0 ? ' '.repeat(lineLength - s.length) : '';
  process.stderr.write(`${s}${spaces}\r`);
};

const moveForward = seconds => (
  new Promise((resolve, reject) => {
    web3.currentProvider.sendAsync({
      method: 'evm_increaseTime',
      params: [seconds],
    }, (err, res) => {
      if (err !== undefined && err !== null) {
        reject(err);
      }

      resolve(res);
    });
  })
);

const advanceBlock = () => (
  new Promise((resolve, reject) => {
    writeProcessMsg('mining blocks... ');
    web3.currentProvider.sendAsync({
      jsonrpc: '2.0',
      method: 'evm_mine',
      id: Date.now(),
    }, (err, res) => (err ? reject(err) : resolve(res)));
  })
);

const advanceToBlock = async (number) => {
  if (web3.eth.blockNumber > number) {
    throw Error(`block number ${number} is in the past (current is ${web3.eth.blockNumber})`);
  }

  const awaits = [];

  const blockCount = number - web3.eth.blockNumber;

  Array(blockCount)
    .fill()
    .forEach(() => awaits.push(advanceBlock()));

  return Promise.all(awaits);
};

const takeSnapshot = () => (
  new Promise((resolve, reject) => {
    web3.currentProvider.sendAsync({
      method: 'evm_snapshot',
    }, (err, res) => {
      if (err !== undefined && err !== null) {
        reject(err);
      }

      const id = parseInt(res, 16);
      resolve(id);
    });
  })
);

const resetSnapshot = id => (
  new Promise((resolve, reject) => {
    web3.currentProvider.sendAsync({
      method: 'evm_revert',
      params: [id],
    }, (err, res) => {
      if (err !== undefined && err !== null) {
        reject(err);
      }

      resolve(res);
    });
  })
);

export {
  writeProcessMsg,
  moveForward,
  takeSnapshot,
  resetSnapshot,
  advanceToBlock,
};
