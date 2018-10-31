const PlasmaCash = artifacts.require('./PlasmaCash.sol');
const MerkleProof = artifacts.require('./MerkleProof.sol');

module.exports = (deployer) => {
  deployer.deploy(MerkleProof).then(() => {
    deployer.link(MerkleProof, PlasmaCash);
  });
};
