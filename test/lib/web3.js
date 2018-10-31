import pify from 'pify';

const Web3 = require('web3');

const web3 = new Web3(Web3.currentProvider || 'http://localhost:8545');

const ethAsync = pify(web3.eth);

export const ethGetBalance = ethAsync.getBalance;
export const ethGetTransactionReceipt = ethAsync.getTransactionReceipt;
export const ethSign = ethAsync.sign;
