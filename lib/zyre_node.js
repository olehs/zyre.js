/*
 * Copyright (c) 2017 Sebastian Rager
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const EventEmitter = require('events');
const { createRouter } = require('./zeromq');
const ZreMsg = require('./zre_msg');
const ZHelper = require('./zhelper');

const debug = ZHelper.debug('zyre:zyre_node');

/**
 * ZyreNode represents the local node which handles incoming messages from other peers.
 *
 * @extends EventEmitter
 */
class ZyreNode extends EventEmitter {
  /**
   * @param {object} options - Options object
   * @param {Buffer} options.identity - 16 byte UUID as Buffer
   * @param {string} options.name - Name of the zyre node
   * @param {string} options.address - Address of the zyre node
   * @param {number} options.mailbox - Network port of the zyre node
   * @param {object} [options.headers={}] - Headers of the zyre node
   * @param {ZyrePeers} options.zyrePeers - Global ZyrePeers object
   * @param {ZyreGroups} options.zyreGroups - Global ZyreGroups object
   * @param {boolean} [options.fullDuplex=false] - Use single connection to send and receive
   */
  constructor({
    identity,
    name,
    address,
    mailbox,
    headers = {},
    zyrePeers,
    zyreGroups,
    fullDuplex,
  }) {
    super();

    this._identity = identity;
    this._name = name;
    this._endpoint = `tcp://${address}:${mailbox}`;
    this._headers = headers;
    this._zyrePeers = zyrePeers;
    this._zyreGroups = zyreGroups;
    this._groups = [];
    this._status = 0;
    this._fullDuplex = fullDuplex;

    this._createHandler();

    this._zyrePeers.on('message', this._messageHandler);
  }

  /**
   * Starts listening for foreign messages, manages incoming messages as defined in ZRE.
   *
   * @fires ZyreNode#hello
   * @fires ZyreNode#whisper
   * @fires ZyreNode#shout
   * @fires ZyreNode#join
   * @fires ZyreNode#leave
   * @return {Promise}
   */
  async startListening() {
    this._zyrePeers.on('new', this._newPeerHandler);

    this._socket = await createRouter({ handover: true });

    const receive = async () => {
      try {
        for (;;) {
          // eslint-disable-next-line no-await-in-loop
          const data = await this._socket.receive();
          if (!data || this._socket.closed) break;

          const [id, msg, frame] = data;
          this._messageHandler(id, msg, frame);
        }
      } catch (e) {
        // ignore error on socket close
        if (!this._socket.closed || e.code !== 'EAGAIN') throw e;
      }
    };

    await this._socket.bind(this._endpoint);
    debug(`listening on ${this._endpoint}`);

    this._receive = receive();
  }

  /**
   * Stops listening for messages and closes the socket.
   *
   * @return {Promise}
   */
  async stopListening() {
    this._zyrePeers.removeListener('new', this._newPeerHandler);

    await this._socket.unbind(this._endpoint);
    await this._socket.close();
    await this._receive.catch(() => {});
    this._receive = undefined;
    this._socket = undefined;
  }

  /**
   * Joins a group.
   *
   * @param {string} group - Name of the group
   */
  async join(group) {
    this._groups.push(group);
    this._status = (this._status + 1) % 255;
    await this._zyrePeers.send(new ZreMsg(ZreMsg.JOIN, {
      group,
      status: this._status,
    }));
  }

  /**
   * Leaves a group.
   *
   * @param {string} group - Name of the group
   */
  async leave(group) {
    const index = this._groups.indexOf(group);
    if (index > -1) {
      this._groups.splice(index, 1);
      this._status = (this._status + 1) % 255;
      await this._zyrePeers.send(new ZreMsg(ZreMsg.LEAVE, {
        group,
        status: this._status,
      }));
    }
  }

  /**
   * Creates handler as object properties in a separate method to ensure proper scope via arrow
   * functions.
   *
   * @protected
   */
  _createHandler() {
    /**
     * Connects to the given ZyrePeer and sends a HELLO message.
     *
     * @protected
     * @param {ZyrePeer} zyrePeer - ZyrePeer
     */
    this._newPeerHandler = async (zyrePeer) => {
      await zyrePeer.connect();
      await zyrePeer.send(new ZreMsg(ZreMsg.HELLO, {
        endpoint: this._endpoint,
        groups: this._groups,
        status: this._status,
        name: this._name,
        headers: this._headers,
        fullDuplex: this._fullDuplex,
      }));
    };

    /**
     * Parses the given id and message, updates the peer information found in the message and takes
     * over message handling.
     *
     * @protected
     * @fires ZyreNode#hello
     * @fires ZyreNode#whisper
     * @fires ZyreNode#shout
     * @fires ZyreNode#join
     * @fires ZyreNode#leave
     * @param {Buffer} id - 16 byte UUID as Buffer with leading byte 01
     * @param {Buffer} msg - Message as binary Buffer
     * @param {Buffer} frame - Message content as binary Buffer
     */
    this._messageHandler = (id, msg, frame) => {
      const zreMsg = ZreMsg.read(msg, frame);

      if (typeof zreMsg === 'undefined') {
        debug('received malformed message');
        return;
      }

      // Remove the leading byte from the id buffer
      const identity = id.slice(1).toString('hex');

      // Reject messages from unknown peers that are not HELLO messages
      if (!this._zyrePeers.exists(identity) && zreMsg.cmd !== ZreMsg.HELLO) {
        debug(`unknown peer (${identity}) wants to send message (${zreMsg.cmd})`);
        return;
      }

      debug(`received message (${zreMsg.cmd}) from ${identity}, seq ${zreMsg.sequence}`);

      const zyrePeer = this._zyrePeers.push({
        identity,
        sequence: zreMsg.sequence,
        endpoint: zreMsg.endpoint,
        status: zreMsg.status,
        name: zreMsg.name,
        headers: zreMsg.headers,
        socket: this._fullDuplex && zreMsg.fullDuplex ? this._socket : undefined,
      });

      // If an error occured in pushing the peer, prevent further event handling
      if (typeof zyrePeer === 'undefined') return;

      // Message handling
      switch (zreMsg.cmd) {
        case ZreMsg.HELLO:
          zreMsg.groups.forEach((group) => {
            this._zyreGroups.push(group, zyrePeer);
            this.emit('join', zyrePeer, group);
          });
          /**
           * @event ZyreNode#hello
           * @property {ZyrePeer} zyrePeer - ZyrePeer
           */
          this.emit('hello', zyrePeer);
          break;

        case ZreMsg.WHISPER:
          /**
           * @event ZyreNode#whisper
           * @property {ZyrePeer} zyrePeer - ZyrePeer
           * @property {Buffer} content - Content of the message
           */
          this.emit('whisper', zyrePeer, zreMsg.content);
          break;

        case ZreMsg.SHOUT:
          if (this._groups.includes(zreMsg.group)) {
            /**
             * @event ZyreNode#shout
             * @property {ZyrePeer} zyrePeer - ZyrePeer
             * @property {Buffer} content - Content of the message
             * @property {string} group - Name of the group
             */
            this.emit('shout', zyrePeer, zreMsg.content, zreMsg.group);
          }
          break;

        case ZreMsg.JOIN:
          this._zyreGroups.push(zreMsg.group, zyrePeer);
          /**
           * @event ZyreNode#join
           * @property {ZyrePeer} zyrePeer - ZyrePeer
           * @property {string} group - Name of the group
           */
          this.emit('join', zyrePeer, zreMsg.group);
          break;

        case ZreMsg.LEAVE:
          this._zyreGroups.remove(zreMsg.group, zyrePeer);
          /**
           * @event ZyreNode#leave
           * @property {ZyrePeer} zyrePeer - ZyrePeer
           * @property {string} group - Name of the group
           */
          this.emit('leave', zyrePeer, zreMsg.group);
          break;

        case ZreMsg.PING:
          zyrePeer.send(new ZreMsg(ZreMsg.PING_OK));
          break;

        default:
      }
    };
  }
}

module.exports = ZyreNode;
