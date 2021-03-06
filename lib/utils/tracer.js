/* eslint-disable no-param-reassign */
const { tracer } = require('@hkube/metrics');
const { uuid } = require('@hkube/uid');

const id = uuid();
const init = async (options) => {
    await tracer.init(options);
};

const topSpanContext = () => {
    const topSpan = tracer.topSpan(id);
    return topSpan && topSpan.context();
};

const traceWrapper = (method, instance, getSpanId = () => ({})) => {
    const methodName = method.name.startsWith('_') ? method.name.slice(1) : method.name;
    const isAsync = method.constructor.name === 'AsyncFunction';
    if (isAsync) {
        return async (...args) => {
            let span = null;
            try {
                const data = args && args[0];
                const { spanId } = getSpanId(data);
                span = tracer.startSpan({ name: methodName, parent: spanId, id });
                const ret = await method.apply(instance, args);
                if (span) {
                    span.finish();
                }
                return ret;
            }
            catch (error) {
                if (span) {
                    span.finish(error);
                }
                throw error;
            }
        };
    }
    return (...args) => {
        let span = null;
        try {
            const data = args && args[0];
            const { spanId } = getSpanId(data);
            span = tracer.startSpan({ name: methodName, parent: spanId, id });
            const ret = method.apply(instance, args);
            if (span) {
                span.finish();
            }
            return ret;
        }
        catch (error) {
            if (span) {
                span.finish(error);
            }
            throw error;
        }
    };
};

const traceWrappers = (methods, instance, getSpanId) => {
    methods.forEach((m) => {
        instance[m] = traceWrapper(instance[m], instance, getSpanId);
    });
};

module.exports = {
    traceWrapper,
    traceWrappers,
    init,
    topSpanContext
};
