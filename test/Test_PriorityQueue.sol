pragma solidity ^0.4.24;

import "truffle/Assert.sol";
import "truffle/DeployedAddresses.sol";

import "../contracts/lib/PriorityQueue.sol";


contract Test_PriorityQueue {
  using PriorityQueue for uint256[];

  uint256[] heapList;
  uint128[] testData;

  constructor () public {
    testData.push(0);
    testData.push(1);
    testData.push(10);
    testData.push(5);
    testData.push(6);
  }

  function test_insert() public {

    Assert.equal(heapList.currentSize(), 0, "should be 0");

    for (uint i = 0; i < testData.length; i++) {
      heapList.insert(testData[i]);
    }

    Assert.equal(heapList.currentSize(), testData.length, "invalid currentSize");
  }

  function test_getMinAndDel() public {

    Assert.equal(heapList.getMin(), 0, "invalid val#1");
    heapList.delMin();
    Assert.equal(heapList.getMin(), 1, "invalid val#2");
    heapList.delMin();
    Assert.equal(heapList.getMin(), 5, "invalid val#3");
    heapList.delMin();
    Assert.equal(heapList.getMin(), 6, "invalid val#4");
    heapList.delMin();
    Assert.equal(heapList.getMin(), 10, "invalid val#5");
    heapList.delMin();

    Assert.equal(heapList.currentSize(), 0, "invalid currentSize");
  }

  function test_incrementing() public {

    Assert.equal(heapList.currentSize(), 0, "invalid currentSize");

    for (uint256 i = 0; i < 50; i++) {
      heapList.insert(i);
      Assert.equal(heapList.getMin(), 0, "invalid val#1");
    }

    for (i = 0; i < 50; i++) {
      Assert.equal(heapList.getMin(), i, "invalid val#1");
      heapList.delMin();
    }

    Assert.equal(heapList.currentSize(), 0, "invalid currentSize");
  }

  function test_yourCase() public {

    // create any case you want to test here

    Assert.equal(heapList.currentSize(), 0, "invalid currentSize");

    heapList.insert(5);
    heapList.insert(4);
    heapList.insert(3);
    heapList.insert(2);

    uint256 last = 0;
    while (heapList.currentSize() > 0) {
      Assert.isAbove(heapList.getMin(), last, "invalid order");
      last = heapList.getMin();
      heapList.delMin();
    }

    Assert.equal(heapList.currentSize(), 0, "invalid currentSize");
  }


}
