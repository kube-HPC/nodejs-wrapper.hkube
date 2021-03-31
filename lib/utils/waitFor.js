const waitFor = async ({ resolveCB, rejectCB, interval = 200 }) => {
    return new Promise((resolve, reject) => {
        const inter = setInterval(() => {  // eslint-disable-line
            const error = rejectCB && rejectCB();
            if (error) {
                clearInterval(inter);
                return reject(error);
            }
            if (resolveCB()) {
                clearInterval(inter);
                return resolve();
            }
        }, interval);
    });
};

module.exports = {
    waitFor
};
