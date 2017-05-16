const assert = require('chai').assert;
const ZyreGroup = require('../lib/zyre_group');

describe('ZyreGroup', () => {
  it('should create an instance of ZyreGroup', () => {
    const zyreGroup = new ZyreGroup();
    assert.instanceOf(zyreGroup, ZyreGroup);
  });
});
