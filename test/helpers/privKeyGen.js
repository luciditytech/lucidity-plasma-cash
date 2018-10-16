const crypto = require('crypto');
const secp256k1 = require('secp256k1');
const ethjsUtil = require('ethereumjs-util');


function privGen() {
  const buf = Buffer.alloc(32);
  let privKey;
  do {
    privKey = crypto.randomFillSync(buf);
  } while (!secp256k1.privateKeyVerify(privKey));

  return privKey;
}

function privToAddr(privKey) {
  return ethjsUtil.bufferToHex(ethjsUtil.pubToAddress(ethjsUtil.privateToPublic(privKey)));
}

function createUser() {
  const privKey = privGen();
  const addr = privToAddr(privKey);
  return { privKey, addr };
}

function shortAddr(addr) {
  return addr.substring(0, 5) + addr.substring(-3);
}


export {
  privGen,
  privToAddr,
  createUser,
  shortAddr,
};
