const PlasmaCash = artifacts.require('./PlasmaCash.sol');

module.exports = (deployer) => {
  deployer.deploy(PlasmaCash, 60);
};
