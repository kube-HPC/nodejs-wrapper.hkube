const { expect } = require("chai");

const start = async (payload, api) => {
    console.log(`algorithm: start`);
    const res = await api.startStoredSubpipeline('foo',{bar: {size: 3, batch: 4}});
    return res;
}

module.exports = {
    start
}
