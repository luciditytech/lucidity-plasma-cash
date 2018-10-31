const PlasmaCash = artifacts.require('./PlasmaCash.sol');
const PriorityQueue = artifacts.require('./PriorityQueue.sol');

module.exports = (deployer) => {
  deployer.deploy(PriorityQueue).then(() => {
    deployer.link(PriorityQueue, PlasmaCash);
  });
};
