/* eslint-disable no-unused-expressions */
/*
 * Copyright (c) 2017 Sebastian Rager
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const { assert, should, expect } = require('chai');
const net = require('net');
const ZHelper = require('../lib/zhelper');

describe('ZHelper', () => {
  it('should create an instance of ZHelper', () => {
    const zHelper = new ZHelper();
    assert.instanceOf(zHelper, ZHelper);
  });

  it('should return public IPv4 interface data', () => {
    const ifdata = ZHelper.getIfData();
    assert.propertyVal(ifdata, 'family', 'IPv4');
    assert.property(ifdata, 'broadcast');
    assert.property(ifdata, 'network');
  });

  it('should check if an IP is in a subnet', () => {
    let ip = '127.100.42.3';
    const network = '127.100.42.0';
    const netmask = '255.255.255.240';

    assert.isTrue(ZHelper.ipInSubnet(ip, network, netmask));

    ip = '127.100.42.16';
    assert.isNotTrue(ZHelper.ipInSubnet(ip, network, netmask));
  });

  it('should return a free TCP port', (done) => {
    const ifdata = ZHelper.getIfData();
    const p = 49152;
    ZHelper.getFreePort(ifdata.address, p).then((port) => {
      assert.isAtLeast(port, p);
      done();
    });
  });

  it('should return a free TCP port also when the initial port is blocked', (done) => {
    const ifdata = ZHelper.getIfData();
    const p = 49152;

    const server = net.createServer();
    server.on('close', () => done());
    server.listen(p, ifdata.address, () => {
      ZHelper.getFreePort(ifdata.address, p).then((port) => {
        assert.isAtLeast(port, p + 1);
        server.close();
      });
    });
  });

  it('should reject on invalid port range', (done) => {
    const ifdata = ZHelper.getIfData();
    const s = 49152;
    const e = 49151;
    ZHelper.getFreePort(ifdata.address, s, e)
      .then(() => {
        should.fail();
        done();
      })
      .catch((error) => {
        expect(error).to.not.be.null;
        expect(error).to.not.be.undefined;
        done();
      });
  });

  it('should stop searching for free port on then end of specified port range', (done) => {
    const ifdata = ZHelper.getIfData();
    const p = 49152;

    const server = net.createServer();
    server.on('close', () => done());
    server.listen(p, ifdata.address, () => {
      ZHelper.getFreePort(ifdata.address, p, p)
        .then(() => {
          should.fail();
          server.close();
        }).catch((error) => {
          expect(error).to.not.be.null;
          expect(error).to.not.be.undefined;
          server.close();
        });
    });
  });
});
