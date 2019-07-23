
const orderBy = require('lodash.orderby');

const start = async (payload) => {
    console.log(`algorithm: start`);
    const [array, order] = payload.input;
    const result = orderBy(array, null, order);
    return result;
}

module.exports = {
    start
}
