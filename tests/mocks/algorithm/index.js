
const orderBy = require('lodash.orderby');

const start = async (payload) => {
    console.log(`algorithm: start`);
    const [array, order] = payload.input;
    const orderResult = orderBy(array, null, order);
    return { orderResult };
}

module.exports = {
    start
}
