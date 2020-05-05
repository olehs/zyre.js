/*
 * Copyright (c) 2017 Sebastian Rager
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const { assert } = require('chai');
const { v4: uuidv4 } = require('uuid');
const dgram = require('dgram');
const EventEmitter = require('events');
const ZHelper = require('../lib/zhelper');
const ZBeacon = require('../lib/zbeacon');

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe('ZBeacon', () => {
  // ZyrePeers mock
  class Peers extends EventEmitter {
    push({ identity, address, mailbox }) {
      this.emit('new', identity, address, mailbox);
    }
  }

  it('should create an instance of ZBeacon', () => {
    const identity = Buffer.alloc(16);
    uuidv4(null, identity, 0);

    const zBeacon = new ZBeacon({
      identity,
      mailbox: 51409,
      ifaceData: ZHelper.getIfData(),
      zyrePeers: new Peers(),
    });

    assert.instanceOf(zBeacon, ZBeacon);
  });

  it('should start broadcasting the zre beacon, listen to foreign beacons and push discovered peers', async () => {
    const ifaceData = ZHelper.getIfData();
    const { address } = ifaceData; // The local address, which is the sender of the udp package

    // Init Peer 1
    const identity = Buffer.alloc(16);
    uuidv4(null, identity, 0);
    const mailbox = 51409;
    const zyrePeers = new Peers();

    const zBeacon = new ZBeacon({
      identity,
      mailbox,
      ifaceData,
      zyrePeers,
    });

    // Init Peer 2
    const identity2 = Buffer.alloc(16);
    uuidv4(null, identity2, 0);
    const mailbox2 = 51410;
    const zyrePeers2 = new Peers();

    const zBeacon2 = new ZBeacon({
      identity: identity2,
      mailbox: mailbox2,
      ifaceData,
      zyrePeers: zyrePeers2,
    });

    // Init test
    let hit = false;

    zyrePeers.on('new', (id, addr, mb) => {
      assert.equal(id, identity2.toString('hex'));
      assert.equal(addr, address);
      assert.equal(mb, mailbox2);
      hit = true;
    });

    await zBeacon.start();
    await zBeacon2.start();
    await delay(100);

    await Promise.all([
      zBeacon.stop(),
      zBeacon2.stop(),
    ]);

    assert(hit);
  });

  it('should discard corrupted udp packages', (done) => {
    const ifaceData = ZHelper.getIfData();
    const { broadcast } = ifaceData;
    const port = 5670;

    // Init Peer
    const identity = Buffer.alloc(16);
    uuidv4(null, identity, 0);
    const mailbox = 51409;
    const zyrePeers = new Peers();

    const zBeacon = new ZBeacon({
      identity,
      mailbox,
      ifaceData,
      port,
      zyrePeers,
    });

    // Init socket
    const socket = dgram.createSocket('udp4');

    // Init test
    let hit = false;

    zyrePeers.on('new', () => {
      hit = true;
    });

    const broadcastWrongLength = () => {
      const buf = Buffer.alloc(18);
      buf.fill('a');
      socket.send(buf, port, broadcast);
    };

    const broadcastWrongHeader = () => {
      const buf = Buffer.alloc(22);
      buf.fill('a');
      socket.send(buf, port, broadcast);
    };

    const stopAll = () => {
      zBeacon.stop().then(() => {
        socket.close(() => {
          if (!hit) setTimeout(() => { done(); }, 100);
        });
      });
    };

    zBeacon.start().then(() => {
      socket.bind(() => {
        socket.setBroadcast(true);
        setTimeout(broadcastWrongLength, 100);
        setTimeout(broadcastWrongHeader, 200);
        setTimeout(stopAll, 300);
      });
    });
  });

  it('should not throw any error if any socket is not initialized on stop', async () => {
    const identity = Buffer.alloc(16);
    uuidv4(null, identity, 0);

    const zBeacon = new ZBeacon({
      identity,
      mailbox: 51409,
      ifaceData: ZHelper.getIfData(),
      zyrePeers: new Peers(),
    });

    await zBeacon.stop();
  });
});
