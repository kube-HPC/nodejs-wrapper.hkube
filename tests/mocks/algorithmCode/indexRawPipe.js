const pipe={
    name: 'foo',
    description: '',
    nodes: [
      {
        algorithmName: 'green-alg',
        input: [
          '@flowInput.bar'
        ],
        nodeName: 'a'
      },
      {
        algorithmName: 'yellow-alg',
        input: [
          '#@a'
        ],
        nodeName: 'b'
      }
    ],
    flowInput: {
      bar: {
        size: 3,
        batch: 4
      }
    },
    triggers: {
      cron: {
        pattern: '0 * * * *',
        enabled: false
      },
      pipelines: []
    },
    options: {
      batchTolerance: 100,
      concurrentPipelines: {
        amount: 10,
        rejectOnFailure: true
      },
      progressVerbosityLevel: 'info',
      ttl: 3600
    },
    priority: 3,
    kind: 'batch',
    experimentName: 'main'
  }

const start = async (payload, api) => {
    console.log(`algorithm: start`);
    const res = await api.startRawSubpipeline('foo',pipe.nodes, {bar: {size: 3, batch: 4}}, pipe.options);
    return res;
}

module.exports = {
    start
}
