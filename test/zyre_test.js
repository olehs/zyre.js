/*
 * Copyright (c) 2017 Sebastian Rager
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const { assert } = require('chai');
const Zyre = require('../lib/zyre');

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe('Zyre', () => {
  it('should create a new instance of Zyre', () => {
    const zyre = new Zyre({ name: 'foo' });
    assert.instanceOf(zyre, Zyre);
    assert.equal(zyre._name, 'foo');

    const zyre2 = Zyre.new({ name: 'foo' });
    assert.instanceOf(zyre2, Zyre);
    assert.equal(zyre2._name, 'foo');
  });

  it('should throw an error if interface data could not be found', () => {
    let hit = false;

    try {
      const zyre = new Zyre({ name: 'zyre1', iface: 'foobar123' });
      zyre.getIdentity();
    } catch (err) {
      if (err.message === 'Could not find IPv4 broadcast interface data') hit = true;
    }

    assert.isTrue(hit);
  });

  it('should inform about connected peers', async () => {
    const zyre1 = new Zyre({ name: 'zyre1', headers: { bar: 'foo' } });
    const zyre2 = new Zyre({ name: 'zyre2', headers: { foo: 'bar' } });

    let hit = 0;

    zyre1.on('connect', (id, name, headers) => {
      assert.strictEqual(id, zyre2.getIdentity());
      if (name === 'zyre2') hit += 1;
      assert.deepEqual(headers, { foo: 'bar' });
      hit += 1;
    });

    zyre2.on('connect', (id, name, headers) => {
      assert.strictEqual(id, zyre1.getIdentity());
      if (name === 'zyre1') hit += 1;
      assert.deepEqual(headers, { bar: 'foo' });
      hit += 1;
    });

    await zyre1.start();
    await zyre2.start();
    await delay(100);

    await zyre2.stop();
    await zyre1.stop();
    await delay(100);

    assert(hit);
  });

  it('should inform about disconnected peers', async () => {
    const zyre1 = new Zyre({ name: 'zyre1' });
    const zyre2 = new Zyre({ name: 'zyre2' });

    let hit = false;

    zyre1.on('disconnect', (id) => {
      assert.strictEqual(id, zyre2.getIdentity());
      hit = true;
    });


    await zyre1.start();
    await zyre2.start();
    await delay(100);

    await zyre2.stop();
    await delay(100);

    assert(hit);
    await zyre1.stop();
  });

  it('should communicate with WHISPER messages', async () => {
    const zyre1 = new Zyre({ name: 'zyre1' });
    const zyre2 = new Zyre({ name: 'zyre2' });

    let hit = false;

    zyre1.on('whisper', (id, name, message) => {
      assert.strictEqual(id, zyre2.getIdentity());
      assert.strictEqual(name, 'zyre2');
      assert.strictEqual(message, 'Hey!');
      hit = true;
    });

    zyre2.on('whisper', (id, name, message) => {
      assert.strictEqual(id, zyre1.getIdentity());
      assert.strictEqual(name, 'zyre1');
      assert.strictEqual(message, 'Hello World!');
      zyre2.whisper(zyre1.getIdentity(), 'Hey!');
    });

    await zyre1.start();
    await zyre2.start();
    await delay(100);

    await zyre1.whisper(zyre2.getIdentity(), 'Hello World!');
    await delay(100);

    await Promise.all([
      zyre2.stop(),
      zyre1.stop(),
    ]);

    assert(hit);
  });

  it('should communicate with SHOUT messages', async () => {
    const zyre1 = new Zyre({ name: 'zyre1' });
    const zyre2 = new Zyre({ name: 'zyre2' });
    const zyre3 = new Zyre({ name: 'zyre3' });

    let hit1 = false;
    let hit2 = false;

    zyre2.on('shout', (id, name, message, group) => {
      assert.strictEqual(id, zyre1.getIdentity());
      assert.strictEqual(name, 'zyre1');
      assert.strictEqual(message, 'Hello World!');
      assert.strictEqual(group, 'CHAT');
      hit1 = true;
    });

    zyre3.on('shout', (id, name, message, group) => {
      assert.strictEqual(id, zyre1.getIdentity());
      assert.strictEqual(name, 'zyre1');
      assert.strictEqual(message, 'Hello World!');
      assert.strictEqual(group, 'CHAT');
      hit2 = true;
    });

    await zyre1.start();
    await zyre1.join('CHAT');
    await zyre2.start();
    await zyre2.join('CHAT');
    await zyre3.start();
    await zyre3.join('CHAT');
    await delay(100);

    await zyre1.shout('CHAT', 'Hello World!');
    await delay(100);

    await Promise.all([
      zyre1.stop(),
      zyre2.stop(),
      zyre3.stop(),
    ]);

    assert(hit1 && hit2);
  });

  it('should communicate with SHOUT messages in mixed-duplex mode', async () => {
    const zyre1 = new Zyre({ name: 'zyre1', fullDuplex: true });
    const zyre2 = new Zyre({ name: 'zyre2', fullDuplex: true });
    const zyre3 = new Zyre({ name: 'zyre3', fullDuplex: false });

    let hit1 = false;
    let hit2 = false;

    zyre2.on('shout', (id, name, message, group) => {
      assert.strictEqual(id, zyre1.getIdentity());
      assert.strictEqual(name, 'zyre1');
      assert.strictEqual(message, 'Hello World!');
      assert.strictEqual(group, 'CHAT');
      hit1 = true;
    });

    zyre3.on('shout', (id, name, message, group) => {
      assert.strictEqual(id, zyre1.getIdentity());
      assert.strictEqual(name, 'zyre1');
      assert.strictEqual(message, 'Hello World!');
      assert.strictEqual(group, 'CHAT');
      hit2 = true;
    });

    await zyre1.start();
    await zyre1.join('CHAT');
    await zyre2.start();
    await zyre2.join('CHAT');
    await zyre3.start();
    await zyre3.join('CHAT');
    await delay(100);

    await zyre1.shout('CHAT', 'Hello World!');
    await delay(100);

    await Promise.all([
      zyre1.stop(),
      zyre2.stop(),
      zyre3.stop(),
    ]);

    assert(hit1 && hit2);
  });

  it('should communicate with WHISPER messages in full-duplex mode', async () => {
    const count = 10;

    const items = Array(count).fill().map((_, i) => i + 1);
    const zyres = items.map((n) => new Zyre({ name: `zyre${n}`, fullDuplex: true }));
    let hits = items.reduce((sum, x) => sum + x);

    zyres.forEach((zyre) => zyre.on('whisper', (id, name, content) => {
      const recipient = parseInt(content, 10);
      if (recipient < count) {
        zyre.whisper(zyres[recipient].getIdentity(), `${recipient + 1}`);
      }
      hits -= recipient;
    }));

    await Promise.all(zyres.map((zyre) => zyre.start()));
    await delay(200);

    await zyres[count - 1].whisper(zyres[0].getIdentity(), '1');
    await delay(200);

    assert.strictEqual(hits, 0);
    await Promise.all(zyres.map((zyre) => zyre.stop()));
  });

  it('should join a group and send JOIN messages', async () => {
    const zyre1 = new Zyre({ name: 'zyre1' });
    const zyre2 = new Zyre({ name: 'zyre2' });

    let hit = false;

    zyre2.on('join', (id, name, group) => {
      assert.strictEqual(id, zyre1.getIdentity());
      assert.strictEqual(name, 'zyre1');
      assert.strictEqual(group, 'CHAT');
      assert.property(zyre2.getGroup('CHAT'), zyre1.getIdentity());
      hit = true;
    });

    await zyre1.start();
    await zyre2.start();
    await delay(100);

    await zyre1.join('CHAT');
    await delay(100);

    await Promise.all([
      zyre1.stop(),
      zyre2.stop(),
    ]);

    assert(hit);
  });

  it('should leave a group and send LEAVE messages', async () => {
    const zyre1 = new Zyre({ name: 'zyre1' });
    const zyre2 = new Zyre({ name: 'zyre2' });

    let hit = false;

    zyre2.on('leave', (id, name, group) => {
      assert.strictEqual(id, zyre1.getIdentity());
      assert.strictEqual(name, 'zyre1');
      assert.strictEqual(group, 'CHAT');
      assert.isNotObject(zyre2.getGroup(name));
      hit = true;
    });

    await zyre1.start();
    await zyre2.start();
    await delay(100);

    await zyre1.join('CHAT');
    await delay(100);

    await zyre1.leave('OTHER');
    await zyre1.leave('CHAT');
    await delay(100);

    await Promise.all([
      zyre1.stop(),
      zyre2.stop(),
    ]);

    assert(hit);
  });

  it('should return ZyrePeer(s) informations', async () => {
    const zyre1 = new Zyre({ name: 'zyre1' });
    const zyre2 = new Zyre({ name: 'zyre2' });

    let hit = false;

    const getPeers = () => {
      assert.isDefined(zyre1.getPeer(zyre2.getIdentity()));
      assert.property(zyre1.getPeers(), zyre2.getIdentity());
      assert.isDefined(zyre2.getPeer(zyre1.getIdentity()));
      assert.property(zyre2.getPeers(), zyre1.getIdentity());
      assert.isNotObject(zyre1.getPeer('foobar42123'));
      hit = true;
    };

    await zyre1.start();
    await zyre2.start();
    await delay(100);

    getPeers();

    await Promise.all([
      zyre1.stop(),
      zyre2.stop(),
    ]);

    assert(hit);
  });

  it('should return ZyreGroup(s) informations', async () => {
    const zyre1 = new Zyre({ name: 'zyre1' });
    const zyre2 = new Zyre({ name: 'zyre2' });

    let hit = false;

    const getGroups = () => {
      assert.isDefined(zyre1.getGroup('TEST'));
      assert.property(zyre1.getGroups(), 'TEST');
      assert.isDefined(zyre2.getGroup('TEST'));
      assert.property(zyre2.getGroups(), 'TEST');
      hit = true;
    };

    await zyre1.start();
    await zyre1.join('TEST');
    await zyre2.start();
    await zyre2.join('TEST');
    await delay(100);

    getGroups();

    await Promise.all([
      zyre1.stop(),
      zyre2.stop(),
    ]);

    assert(hit);
  });

  it('should inform about expired peers', async () => {
    const evasive = 200;
    const expired = 400;

    const zyre1 = new Zyre({ name: 'zyre1', evasive, expired });
    const zyre2 = new Zyre({ name: 'zyre2', evasive, expired });

    let hit = false;

    zyre1.on('expired', (id, name) => {
      assert.strictEqual(id, zyre2.getIdentity());
      assert.strictEqual(name, 'zyre2');
      hit = true;
    });

    const stopTimeouts = () => {
      clearInterval(zyre1._zBeacon._broadcastTimer);
      clearInterval(zyre2._zBeacon._broadcastTimer);
      assert.isDefined(zyre1.getPeer(zyre2.getIdentity()));
      assert.isDefined(zyre2.getPeer(zyre1.getIdentity()));
      clearTimeout(zyre1._zyrePeers._peers[zyre2.getIdentity()]._evasiveTimeout);
      clearTimeout(zyre2._zyrePeers._peers[zyre1.getIdentity()]._evasiveTimeout);
    };

    await zyre1.start();
    await zyre2.start();
    await delay(100);

    stopTimeouts();
    await delay(expired);

    await Promise.all([
      zyre1.stop(),
      zyre2.stop(),
    ]);

    assert(hit);
  });

  it('should support different encodings for messages', async () => {
    const zyre1 = new Zyre();
    const zyre2 = new Zyre();

    let hit = 0;

    zyre1.on('shout', (id, name, msg) => {
      hit += 1;
      if (hit === 1 || hit === 2) assert.isTrue(Buffer.isBuffer(msg));
      if (hit === 3) assert.strictEqual(msg, 'asdC$C6C<b\u0002,');
      if (hit === 4) assert.strictEqual(msg, 'asdäöü€');
      if (hit === 5 || hit === 6) assert.strictEqual(msg, '跧꒍軬뚎諮芲');
      if (hit === 7) assert.strictEqual(msg, 'WVhOa3c2VER0c084NG9Lcw==');
      if (hit === 8) assert.strictEqual(msg, 'asdÃÂ¤ÃÂ¶ÃÂ¼Ã¢ÂÂ¬');
      if (hit === 9) assert.strictEqual(msg, '363137333634633361346333623663336263653238326163');
      if (hit === 10) assert.strictEqual(msg, 'asdäöü€');
    });

    const sendMessage = async (encoding) => {
      zyre1.setEncoding(encoding);

      if (encoding === null || encoding === 'raw') {
        await zyre2.shout('CHAT', Buffer.from('asdäöü€'));
      } else if (encoding === 'garbish') {
        await zyre2.shout('CHAT', 'asdäöü€');
      } else {
        await zyre2.shout('CHAT', Buffer.from('asdäöü€').toString(encoding));
      }
      await delay(50);
    };

    await zyre1.start();
    await zyre1.join('CHAT');
    await zyre2.start();
    await zyre2.join('CHAT');
    await delay(50);

    await sendMessage(null);
    await sendMessage('raw');
    await sendMessage('ascii');
    await sendMessage('utf8');
    await sendMessage('utf16le');
    await sendMessage('ucs2');
    await sendMessage('base64');
    await sendMessage('binary');
    await sendMessage('hex');
    await sendMessage('garbish');

    await Promise.all([
      zyre1.stop(),
      zyre2.stop(),
    ]);

    assert(hit === 10);
  });
});
