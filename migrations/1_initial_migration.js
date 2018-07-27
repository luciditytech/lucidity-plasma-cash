const Migrations = artifacts.require('./PriorityQueue.sol');

module.exports = (deployer) => {
  deployer.deploy(Migrations);
};

