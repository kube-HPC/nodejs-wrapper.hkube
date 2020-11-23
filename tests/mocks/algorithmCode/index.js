const { expect } = require("chai");

const start = async (payload, api) => {
    console.log(`algorithm: start`);
    const res = await api.startAlgorithm('foo',[1,2,3]);
    return res;
}

module.exports = {
    start
}
