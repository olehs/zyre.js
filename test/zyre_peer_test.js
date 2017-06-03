/*
 * Copyright (c) 2017 Sebastian Rager
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const assert = require('chai').assert;
const ZyrePeer = require('../lib/zyre_peer');

describe('ZyrePeer', () => {
  it('should create an instance of ZyrePeer', () => {
    const zyrePeer = new ZyrePeer({
      identity: '12345',
    });

    assert.instanceOf(zyrePeer, ZyrePeer);
  });

  it('should mark an evasive peer', function (done) {
    // Set higher timeout to test evasive peers
    this.timeout(ZyrePeer.PEER_EVASIVE + 1000);

    const zyrePeer = new ZyrePeer({
      identity: '12345',
    });

    zyrePeer.update({
      sequence: 1,
    });

    zyrePeer.on('evasive', () => {
      done();
    });
  });

  it('should mark an expired peer', function (done) {
    // Set higher timeout to test expired peers
    this.timeout(ZyrePeer.PEER_EXPIRED + 1000);

    const zyrePeer = new ZyrePeer({
      identity: '12345',
    });

    zyrePeer.update({
      sequence: 1,
    });

    zyrePeer.on('expired', () => {
      done();
    });
  });
});
