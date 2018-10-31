export default function getTransactionReceiptMined(txHash, interval) {
  const self = this;
  const transactionReceiptAsync = (resolve, reject) => {
    self.getTransactionReceipt(txHash, (error, receipt) => {
      if (error) {
        reject(error);
      } else if (receipt === null) {
        setTimeout(
          () => transactionReceiptAsync(resolve, reject),
          interval || 500,
        );
      } else {
        resolve(receipt);
      }
    });
  };

  if (Array.isArray(txHash)) {
    return Promise.all(txHash.map(oneTxHash => getTransactionReceiptMined(oneTxHash, interval)));
  } if (typeof txHash === 'string') {
    return new Promise(transactionReceiptAsync);
  }
  throw new Error(`Invalid Type: ${txHash}`);
}

web3.eth.getTransactionReceiptMined = getTransactionReceiptMined;
