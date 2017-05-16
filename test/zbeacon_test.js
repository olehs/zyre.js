const assert = require('chai').assert;
const uuid = require('uuid');
const ZHelper = require('../lib/zhelper');
const ZBeacon = require('../lib/zbeacon');
const ZyrePeer = require('../lib/zyre_peer');

describe('ZBeacon', () => {
  it('should create an instance of ZBeacon', () => {
    const id = Buffer.alloc(16);
    uuid.v4(null, id, 0);
    const zyrePeer = new ZyrePeer();
    const zBeacon = new ZBeacon({
      id,
      zyrePeer,
      mailbox: 51409,
      ifaceData: ZHelper.getIfData(),
    });
    assert.instanceOf(zBeacon, ZBeacon);
  });

  it('should start broadcasting the zre beacon, listen to foreign beacons and stop when a beacon is received', (done) => {
    const id = Buffer.alloc(16);
    uuid.v4(null, id, 0);
    const zyrePeer = new ZyrePeer();
    const zBeacon = new ZBeacon({
      id,
      zyrePeer,
      mailbox: 51409,
      ifaceData: ZHelper.getIfData(),
    });

    const id2 = Buffer.alloc(16);
    uuid.v4(null, id2, 0);
    const zyrePeer2 = new ZyrePeer();
    const zBeacon2 = new ZBeacon({
      id: id2,
      zyrePeer: zyrePeer2,
      mailbox: 51410,
      ifaceData: ZHelper.getIfData(),
    });

    zyrePeer.on('new', (peerID) => {
      assert.equal(peerID, id2.toString('hex'));
      zBeacon.stop();
      zBeacon2.stop();
      done();
    });

    zBeacon.startListening().then(() => {
      zBeacon2.startBroadcasting();
    });
  });
});
