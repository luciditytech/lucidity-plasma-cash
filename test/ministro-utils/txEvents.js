const debug = 0;

/**
 * @version 2018-08-23
 *
 * @dev this module goes throw all logs and base on parameters, does some actions
 *
 * @param txLogs - transaction logs, required
 * @param eventName - name of event we are looking for,
 * if there is no such event, error is throw, optional
 * @param logCount - number of logs that transaction should emits,
 * if different number then error is throw, false if we don't care
 *
 * @return array or all events
 */
export default function txEvents(txLogs, eventName, logCount) {
  if ((typeof txLogs !== 'object') && !Array.isArray(txLogs)) {
    assert(false, '[txEvents] Logs must be object or array');
    return null;
  }

  if (logCount) {
    assert.strictEqual(txLogs.length, logCount, '[txEvents] Amount of emitted logs invalid');
  }

  if (debug) console.log('typeof _txLogs', typeof txLogs);
  if (debug) console.log('_txLogs.length', txLogs.length);

  const obj = {};

  for (let i = 0; i < txLogs.length; i += 1) {
    const log = txLogs[i];
    if (debug) console.log(log);

    // if we don't have this type of log yet, then initiate empty array
    if (typeof obj[log.event] === 'undefined') obj[log.event] = [];
    obj[log.event].push(log.args);
  }

  if (debug) console.log(obj);

  // do we need specific log?
  if (eventName) {
    if (typeof obj[eventName] === 'undefined') {
      assert(false, `[txEvents] Expected event \`${eventName}\` does not exist`);
      return null;
    }
  }

  return obj;
}
