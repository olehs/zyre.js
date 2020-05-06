/*
 * Copyright (c) 2017 Sebastian Rager
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const EventEmitter = require('events');
const { createDealer } = require('./zeromq');
const ZHelper = require('./zhelper');

const debug = ZHelper.debug('zyre:zyre_channel');

const ID_PREFIX = 1;

/**
 * ZyreChannel represents a channell between foreign peer and a node.
 *
 * @extends EventEmitter
 */
class ZyreChannel extends EventEmitter {
  constructor({ identity, originID, socket }) {
    super();
    this.identity = identity;
    this._peerIdentity = Buffer.concat([
      Buffer.from([ID_PREFIX]),
      Buffer.from(identity, 'hex'),
    ]);
    this._originID = originID;
    this._socket = socket;
    this.connected = false;
  }

  async connect(endpoint) {
    if (!this._socket) {
      this._socket = await createDealer({
        routingId: Buffer.concat([Buffer.from([ID_PREFIX]), this._originID]),
        linger: 0,
      });

      const receive = async () => {
        try {
          for (;;) {
            // eslint-disable-next-line no-await-in-loop
            const data = await this._socket.receive();
            if (!data || this._socket.closed) break;

            const [msg, frame] = data;
            /**
             * @event ZyreChannel#message
             * @property {Buffer} id - 16 byte UUID as Buffer with leading byte 01
             * @property {Buffer} msg - Message as binary Buffer
             * @property {Buffer} frame - Message content as binary Buffer
             */
            this.emit('message', this._peerIdentity, msg, frame);
          }
        } catch (e) {
          // ignore error on socket close
          if (!this._socket.closed || e.code !== 'EAGAIN') throw e;
        }
      };

      await this._socket.connect(endpoint);
      this._receive = receive();
      this.connected = true;
      debug(`connected to ${this.identity}`);
    }
  }

  async disconnect(endpoint) {
    if (this.connected) {
      try {
        await this._socket.disconnect(endpoint);
        await this._socket.close();
        await this._receive;
      } catch (err) {
        debug('disconnect error', err);
      }
      this._receive = undefined;
      this._socket = undefined;
      this.connected = false;

      debug(`disconnected from ${this.identity}`);
    }
  }

  async send(msg) {
    if (this._socket) {
      let data = msg;
      if (!this.connected) {
        if (!Array.isArray(data)) data = [data];
        data.unshift(this._peerIdentity);
      }

      await this._socket.send(data).catch((err) => {
        debug('send error', err);
      });
    }
  }
}

module.exports = ZyreChannel;
