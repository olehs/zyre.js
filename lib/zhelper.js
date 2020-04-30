/*
 * Copyright (c) 2017 Sebastian Rager
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const os = require('os');
const net = require('net');
const debug = require('debug');

/**
 * ZHelper contains some necessary static helper methods.
 */
class ZHelper {
  /**
   * @typedef {object} IfaceData
   * @property {string} address - IP address
   * @property {string} netmask - Netmask
   * @property {string} family - IPv4 or IPv6
   * @property {string} mac - MAC address
   * @property {boolean} internal - Internal or external
   * @property {string} network - Network address
   * @property {string} broadcast - Broadcast address
   */

  /**
   * Returns IPv4 interface data from the given interface, or searches for a public interface with
   * an assigned IPv4. Also calculates the network and broadcast address of the interface.
   *
   * @param {string} [iface] - Optional interface to check
   * @return {IfaceData}
   */
  static getIfData(iface) {
    const ifaces = os.networkInterfaces();
    if (typeof ifaces === 'undefined') return undefined;

    // Iterate over all interfaces if no interface has been passed
    if (typeof iface === 'undefined') {
      let y;

      Object.keys(ifaces).some((i) => {
        y = this.getIfData(i);
        return typeof y !== 'undefined';
      });

      return y;
    }

    const selIface = ifaces[iface];
    if (typeof selIface === 'undefined') return undefined;

    let ifdata;

    Object.keys(selIface).some((i) => {
      if (!selIface[i].internal && selIface[i].family === 'IPv4') {
        ifdata = selIface[i];
      }
      return typeof ifdata !== 'undefined';
    });

    if (typeof ifdata === 'undefined') return undefined;

    const addressArr = ifdata.address.split('.');
    const netmaskArr = ifdata.netmask.split('.');
    let network = '';
    let broadcast = '';

    addressArr.forEach((e, i) => {
      network += e & netmaskArr[i];
      broadcast += e | (netmaskArr[i] ^ 255);
      if (i < addressArr.length - 1) {
        network += '.';
        broadcast += '.';
      }
    });

    ifdata.network = network;
    ifdata.broadcast = broadcast;

    return ifdata;
  }

  /**
   * Checks if a given IP is in the subnet of the given network address and netmask.
   *
   * @param {string} ip - Ip that should be checked
   * @param {string} network - Network address
   * @param {string} netmask - Netmask
   * @return {boolean}
   */
  static ipInSubnet(ip, network, netmask) {
    const ipArr = ip.split('.');
    const netmaskArr = netmask.split('.');
    let calcNet = '';

    ipArr.forEach((e, i) => {
      calcNet += e & netmaskArr[i];
      if (i < ipArr.length - 1) calcNet += '.';
    });

    return calcNet === network;
  }

  /**
   * Finds a free TCP port starting from the given port, incremented by one.
   *
   * @param {string} host - Host address to search on
   * @param {number} startPort - Port to start searching from
   * @param {number} endPort - Port to stop searching at
   * @return {Promise.<port>}
   */
  static getFreePort(host, startPort, endPort = 65535) {
    const server = net.createServer(() => { /* empty connection handler */ });

    return new Promise((resolve, reject) => {
      if (endPort < startPort) {
        reject(new Error(`Invalid port range: ${startPort}-${endPort}`));
      }

      let found = false;
      server.on('error', () => {
        server.close();
      });

      server.on('close', () => {
        if (found) {
          resolve(startPort);
          return;
        }

        if (startPort === endPort) {
          reject(new Error('Available port not found'));
          return;
        }

        this.getFreePort(host, startPort + 1, endPort).then((portRec) => {
          resolve(portRec);
        });
      });

      server.listen({ port: startPort, host }, () => {
        found = true;
        server.close();
      });
    });
  }
}

module.exports = ZHelper;
module.exports.debug = debug;
