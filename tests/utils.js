
const waitFor = async (predicate, interval = 1000) => {
    return new Promise((resolve) => {
        const inter = setInterval(() => {
            if (predicate()) {
                clearInterval(inter);
                return resolve();
            }
        }, interval);
    });
}

module.exports = {
    waitFor
};
