const assert = require('chai').assert;
const ZreMsg = require('../lib/zre_msg');

describe('ZreMsg', () => {
  it('should create an instance of ZreMsg', () => {
    const zreMsg = new ZreMsg();
    assert.instanceOf(zreMsg, ZreMsg);
  });
});
