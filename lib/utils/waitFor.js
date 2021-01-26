const waitFor = async ({ resolveCB, rejectCB, interval = 1000 }) => {
    return new Promise((resolve, reject) => {
        const inter = setInterval(() => {
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
}

module.exports = {
    waitFor
};
