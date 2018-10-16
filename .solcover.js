module.exports = {
  copyPackages: ['openzeppelin-solidity', 'zeppelin-solidity', 'pokedex', 'token-sale-contracts'],
  port: 8555,
  norpc: false,
  compileCommand: 'truffle compile --all',
  testCommand: 'truffle test --network coverage',
  skipFiles: ['lib/ECRecovery.sol', 'lib/RLP.sol']
}
