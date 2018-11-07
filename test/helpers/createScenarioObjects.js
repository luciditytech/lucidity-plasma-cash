import PlasmaUser from '../lib/PlasmaUser';
import PlasmaOperator from '../lib/PlasmaOperator';


const PlasmaCash = artifacts.require('PlasmaCash');
const ministroPlasmaUtil = require('../ministro-contracts/ministroPlasma');

const ministroPlasma = ministroPlasmaUtil();

const challengeTimeoutSec = 60 * 60 * 24;
const challengeTimeoutSecPass = challengeTimeoutSec + 5;
const exitBond = 1000;

const scenarioObjects = async (accounts, noOfUsers) => {
  const plasmaInstance = await PlasmaCash.new(challengeTimeoutSec, exitBond);
  ministroPlasma.setInstanceVar(plasmaInstance);
  await ministroPlasma.setOperator(accounts[0], true, { from: accounts[0] });

  const plasmaOperator = new PlasmaOperator(accounts[0], ministroPlasma);
  plasmaOperator.setPlasmaCash(ministroPlasma);

  const users = [];
  for (let i = 1; i <= noOfUsers; i += 1) {
    if (!accounts[i]) {
      throw new Error(`not enough accounts, have: ${accounts.length} need: ${noOfUsers + 1}`);
    }
    const user = new PlasmaUser(accounts[i]);
    user.setPlasmaCash(ministroPlasma);
    users.push(user);
  }

  return {
    ministroPlasma,
    plasmaOperator,
    users,
  };
};

export {
  challengeTimeoutSec,
  exitBond,
  scenarioObjects,
  challengeTimeoutSecPass,
};
