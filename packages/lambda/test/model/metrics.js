import assert from 'assert'
import sinon from 'sinon'
import CloudWatch from 'aws/cloudWatch'
import CloudFormation from 'aws/cloudFormation'
import S3 from 'aws/s3'
import { Metrics, Metric } from 'model/metrics'
import MetricsStore from 'db/metrics'
import { monitoringServices, metricStatusVisible, metricStatusHidden } from 'utils/const'

describe('Metrics', () => {
  describe('listExternal', () => {
    afterEach(() => {
      CloudWatch.prototype.listMetrics.restore()
    })

    it('should return a list of external metrics', async () => {
      const metrics = [{metricID: 1}, {metricID: 2}]
      sinon.stub(CloudWatch.prototype, 'listMetrics').returns(metrics)

      const comps = await new Metrics().listExternal()
      assert(comps.length === 2)
      assert(comps[0].metricID === 1)
      assert(comps[1].metricID === 2)
    })

    it('should return error when the store throws exception', async () => {
      sinon.stub(CloudWatch.prototype, 'listMetrics').throws()
      let error
      try {
        await new Metrics().listExternal()
      } catch (e) {
        error = e
      }
      assert(error.message.match(/Error/))
    })
  })

  describe('listPublic', () => {
    afterEach(() => {
      MetricsStore.prototype.getAll.restore()
    })

    it('should return a list of public metrics', async () => {
      const metrics = [{metricID: 1, status: metricStatusVisible}, {metricID: 2, status: metricStatusHidden}]
      sinon.stub(MetricsStore.prototype, 'getAll').returns(metrics)

      const comps = await new Metrics().listPublic()
      assert(comps.length === 1)
      assert(comps[0].metricID === 1)
    })

    it('should return error when the store throws exception', async () => {
      sinon.stub(MetricsStore.prototype, 'getAll').throws()
      let error
      try {
        await new Metrics().listPublic()
      } catch (e) {
        error = e
      }
      assert(error.message.match(/Error/))
    })
  })

  describe('list', () => {
    afterEach(() => {
      MetricsStore.prototype.getAll.restore()
    })

    it('should return a list of metrics', async () => {
      const metrics = [{metricID: 1}, {metricID: 2}]
      sinon.stub(MetricsStore.prototype, 'getAll').returns(metrics)

      const comps = await new Metrics().list()
      assert(comps.length === 2)
      assert(comps[0].metricID === 1)
      assert(comps[1].metricID === 2)
    })

    it('should return error when the store throws exception', async () => {
      sinon.stub(MetricsStore.prototype, 'getAll').throws()
      let error
      try {
        await new Metrics().list()
      } catch (e) {
        error = e
      }
      assert(error.message.match(/Error/))
    })
  })

  describe('lookup', () => {
    afterEach(() => {
      MetricsStore.prototype.getByID.restore()
    })

    it('should return one metric', async () => {
      sinon.stub(MetricsStore.prototype, 'getByID').returns([{metricID: 1}])

      const comp = await new Metrics().lookup(1)
      assert(comp.metricID === 1)
    })

    it('should return error when matched no metric', async () => {
      sinon.stub(MetricsStore.prototype, 'getByID').returns([])
      let error
      try {
        await new Metrics().lookup(1)
      } catch (e) {
        error = e
      }
      assert(error.name === 'NotFoundError')
    })

    it('should return error when matched multiple metrics', async () => {
      sinon.stub(MetricsStore.prototype, 'getByID').returns([{metricID: 1}, {metricID: 1}])
      let error
      try {
        await new Metrics().lookup(1)
      } catch (e) {
        error = e
      }
      assert(error.name === 'Error')
    })
  })
})

describe('Metric', () => {
  const genMock = () => new Metric(undefined, monitoringServices[0], 'title', 'unit', 'description',
                                   metricStatusVisible, 1, {})

  describe('constructor', () => {
    it('should construct a new instance', () => {
      const comp = new Metric('1', 'type', 'title', 'unit', 'description', 'status', 1, {})
      assert(comp.metricID === '1')
      assert(comp.type === 'type')
      assert(comp.title === 'title')
      assert(comp.unit === 'unit')
      assert(comp.description === 'description')
      assert(comp.status === 'status')
      assert(comp.order === 1)
      assert.deepEqual(comp.props, {})
    })

    it('should fill in insufficient values', () => {
      const comp = new Metric(undefined, 'type', 'title', 'unit', 'description', 'status', undefined, {})
      assert(comp.metricID.length === 12)
      assert(typeof comp.order === 'number')
    })
  })

  describe('validate', () => {
    it('should return no error when input is valid', async () => {
      const comp = genMock()
      let error
      try {
        await comp.validate()
      } catch (e) {
        error = e
      }
      assert(error === undefined)
    })

    it('should return error when metricID is invalid', async () => {
      const comp = genMock()
      comp.metricID = ''
      let error
      try {
        await comp.validate()
      } catch (e) {
        error = e
      }
      assert(error.name === 'ValidationError')
    })

    it('should return error when metricID does not exist', async () => {
      sinon.stub(MetricsStore.prototype, 'getByID').returns([])
      const comp = new Metric('1', monitoringServices[0], 'title', 'unit', 'description',
                              metricStatusVisible, 1, {})
      let error
      try {
        await comp.validate()
      } catch (e) {
        error = e
      }
      assert(error.name === 'NotFoundError')
      MetricsStore.prototype.getByID.restore()
    })

    it('should return error when type is invalid', async () => {
      const comp = genMock()
      comp.type = ''
      let error
      try {
        await comp.validate()
      } catch (e) {
        error = e
      }
      assert(error.name === 'ValidationError')
    })

    it('should return error when title is invalid', async () => {
      const comp = genMock()
      comp.title = ''
      let error
      try {
        await comp.validate()
      } catch (e) {
        error = e
      }
      assert(error.name === 'ValidationError')
    })

    it('should return no error when unit is empty', async () => {
      const comp = genMock()
      comp.unit = ''
      let error
      try {
        await comp.validate()
      } catch (e) {
        error = e
      }
      assert(error === undefined)
    })

    it('should return error when unit is invalid', async () => {
      const comp = genMock()
      comp.unit = undefined
      let error
      try {
        await comp.validate()
      } catch (e) {
        error = e
      }
      assert(error.name === 'ValidationError')
    })

    it('should return no error when description is empty', async () => {
      const comp = genMock()
      comp.description = ''
      let error
      try {
        await comp.validate()
      } catch (e) {
        error = e
      }
      assert(error === undefined)
    })

    it('should return error when description is invalid', async () => {
      const comp = genMock()
      comp.description = undefined
      let error
      try {
        await comp.validate()
      } catch (e) {
        error = e
      }
      assert(error.name === 'ValidationError')
    })

    it('should return error when status is invalid', async () => {
      const comp = genMock()
      comp.status = ''
      let error
      try {
        await comp.validate()
      } catch (e) {
        error = e
      }
      assert(error.name === 'ValidationError')
    })

    it('should return error when order is string', async () => {
      const comp = genMock()
      comp.order = 'order'
      let error
      try {
        await comp.validate()
      } catch (e) {
        error = e
      }
      assert(error.name === 'ValidationError')
    })

    it('should return error when order is float', async () => {
      const comp = genMock()
      comp.order = 1.1
      let error
      try {
        await comp.validate()
      } catch (e) {
        error = e
      }
      assert(error.name === 'ValidationError')
    })

    it('should return error when props is string', async () => {
      const comp = genMock()
      comp.props = '{}'
      let error
      try {
        await comp.validate()
      } catch (e) {
        error = e
      }
      assert(error.name === 'ValidationError')
    })
  })

  describe('getBucketName', () => {
    afterEach(() => {
      CloudFormation.prototype.getStatusPageBucketName.restore()
    })

    it('should return the bucket name and save it', async () => {
      const expected = 'bucket'
      sinon.stub(CloudFormation.prototype, 'getStatusPageBucketName').returns(expected)

      const metric = genMock()
      const actual = await metric.getBucketName()
      assert(expected === actual)
      assert(expected === metric.bucketName)
    })

    it('should reuse the previously fetched bucket name', async () => {
      const expected = 'bucket'
      const stub = sinon.stub(CloudFormation.prototype, 'getStatusPageBucketName').returns(expected)

      const metric = genMock()
      await metric.getBucketName()
      await metric.getBucketName()
      assert(stub.calledOnce)
    })
  })

  describe('getDatapoints', () => {
    afterEach(() => {
      S3.prototype.getObject.restore()
      CloudFormation.prototype.getStatusPageBucketName.restore()
    })

    it('should return datapoints at the specified date', async () => {
      const date = new Date(2017, 6, 3, 0, 0, 0)
      const timestamp = date.toISOString()
      const value = 1
      const expected = {Body: new Buffer(`[{"timestamp":"${timestamp}","value":${value}}]`)}
      const stub = sinon.stub(S3.prototype, 'getObject').returns(expected)
      sinon.stub(CloudFormation.prototype, 'getStatusPageBucketName').returns('bucket')

      const metric = genMock()

      const actual = await metric.getDatapoints(date)
      assert(actual.length === 1)
      assert(actual[0].timestamp === timestamp)
      assert(actual[0].value === value)

      assert(stub.calledOnce)
      assert(stub.args[0][2] === `metrics/${metric.metricID}/2017/7/3.json`)
    })

    it('should return null if no datapoint', async () => {
      const date = new Date(2017, 6, 3, 0, 0, 0)
      sinon.stub(S3.prototype, 'getObject').throws()
      sinon.stub(CloudFormation.prototype, 'getStatusPageBucketName').returns('')

      const metric = genMock()

      const actual = await metric.getDatapoints(date)
      assert(actual === null)
    })
  })

  describe('insertDatapoints', () => {
    afterEach(() => {
      S3.prototype.getObject.restore()
      S3.prototype.putObject.restore()
      CloudFormation.prototype.getStatusPageBucketName.restore()
    })

    it('should insert a datapoint in the order of timestamp', async () => {
      const existingDatapoints = [{timestamp: '2017-07-03T01:00:00.000Z', value: 1}]
      const datapoints = {Body: new Buffer(JSON.stringify(existingDatapoints))}
      sinon.stub(S3.prototype, 'getObject').returns(datapoints)
      const stub = sinon.stub(S3.prototype, 'putObject').returns()
      sinon.stub(CloudFormation.prototype, 'getStatusPageBucketName').returns('bucket')

      const metric = genMock()
      const newDatapoints = [{timestamp: '2017-07-03T00:00:00.000Z', value: 0}]
      const insertedData = await metric.insertDatapoints(newDatapoints)

      assert(insertedData.length === 1)

      const argsOnFirstCall = stub.args[0]
      assert(argsOnFirstCall[2] === `metrics/${metric.metricID}/2017/7/3.json`)
      assert(argsOnFirstCall[3].length === 2)
      assert(argsOnFirstCall[3][0].timestamp === newDatapoints[0].timestamp)
      assert(argsOnFirstCall[3][1].timestamp === existingDatapoints[0].timestamp)
    })

    it('should create new S3 object if the object does not exist', async () => {
      sinon.stub(S3.prototype, 'getObject').throws(new Error())
      const stub = sinon.stub(S3.prototype, 'putObject').returns()
      sinon.stub(CloudFormation.prototype, 'getStatusPageBucketName').returns('bucket')

      const metric = genMock()
      const newDatapoints = [{timestamp: '2017-07-03T00:00:00.000Z', value: 0}]
      const insertedData = await metric.insertDatapoints(newDatapoints)

      assert(insertedData.length === 1)

      const argsOnFirstCall = stub.args[0]
      assert(argsOnFirstCall[2] === `metrics/${metric.metricID}/2017/7/3.json`)
      assert(argsOnFirstCall[3].length === 1)
      assert(argsOnFirstCall[3][0].timestamp === newDatapoints[0].timestamp)
      assert(argsOnFirstCall[3][0].value === newDatapoints[0].value)
    })

    it('should insert multiple datapoints in the order of timestamp', async () => {
      const existingDatapoints = [{timestamp: '2017-07-03T02:00:00.000Z', value: 2}]
      const datapoints = {Body: new Buffer(JSON.stringify(existingDatapoints))}
      sinon.stub(S3.prototype, 'getObject').returns(datapoints)
      const stub = sinon.stub(S3.prototype, 'putObject').returns()
      sinon.stub(CloudFormation.prototype, 'getStatusPageBucketName').returns('bucket')

      const metric = genMock()
      const newDatapoints = [{timestamp: '2017-07-03T01:00:00.000Z', value: 1},
                             {timestamp: '2017-07-03T00:00:00.000Z', value: 0}]
      const insertedData = await metric.insertDatapoints(newDatapoints)

      assert(insertedData.length === 2)

      const argsOnFirstCall = stub.args[0]
      assert(argsOnFirstCall[2] === `metrics/${metric.metricID}/2017/7/3.json`)
      assert(argsOnFirstCall[3].length === 3)
      assert(argsOnFirstCall[3][0].value === 0)
      assert(argsOnFirstCall[3][1].value === 1)
      assert(argsOnFirstCall[3][2].value === 2)
    })

    it('should update multiple objects if there are multiple dates', async () => {
      sinon.stub(S3.prototype, 'getObject').throws(new Error())
      const stub = sinon.stub(S3.prototype, 'putObject').returns()
      sinon.stub(CloudFormation.prototype, 'getStatusPageBucketName').returns('bucket')

      const metric = genMock()
      const newDatapoints = [{timestamp: '2017-07-02T00:00:00.000Z', value: 0},
                             {timestamp: '2017-07-03T00:00:00.000Z', value: 1}]
      const insertedData = await metric.insertDatapoints(newDatapoints)

      assert(insertedData.length === 2)

      const argsOnFirstCall = stub.args[0]
      assert(argsOnFirstCall[2] === `metrics/${metric.metricID}/2017/7/2.json`)
      assert(argsOnFirstCall[3].length === 1)
      assert(argsOnFirstCall[3][0].timestamp === newDatapoints[0].timestamp)

      const argsOnSecondCall = stub.args[1]
      assert(argsOnSecondCall[2] === `metrics/${metric.metricID}/2017/7/3.json`)
      assert(argsOnSecondCall[3].length === 1)
      assert(argsOnSecondCall[3][0].timestamp === newDatapoints[1].timestamp)
    })

    it('should update the existing datapoints if the timestamp is same', async () => {
      const existingDatapoints = [{timestamp: '2017-07-03T01:00:00.000Z', value: 1}]
      const datapoints = {Body: new Buffer(JSON.stringify(existingDatapoints))}
      sinon.stub(S3.prototype, 'getObject').returns(datapoints)
      const stub = sinon.stub(S3.prototype, 'putObject').returns()
      sinon.stub(CloudFormation.prototype, 'getStatusPageBucketName').returns('bucket')

      const metric = genMock()
      const newDatapoints = [{timestamp: '2017-07-03T01:00:05.000Z', value: 2}]
      const insertedData = await metric.insertDatapoints(newDatapoints)

      assert(insertedData.length === 1)

      const argsOnFirstCall = stub.args[0]
      assert(argsOnFirstCall[2] === `metrics/${metric.metricID}/2017/7/3.json`)
      assert(argsOnFirstCall[3].length === 1)
      assert(argsOnFirstCall[3][0].timestamp === newDatapoints[0].timestamp)
      assert(argsOnFirstCall[3][0].value === newDatapoints[0].value)
    })

    it('should throw error if the timestamp is invalid', async () => {
      sinon.stub(S3.prototype, 'getObject').returns({})
      sinon.stub(S3.prototype, 'putObject').returns()
      sinon.stub(CloudFormation.prototype, 'getStatusPageBucketName').returns('')

      const metric = genMock()
      const newDatapoints = [{timestamp: 'invalid', value: 1}]
      try {
        await metric.insertDatapoints(newDatapoints)
        assert(false)
      } catch (error) {
        assert(error.message.match(/invalid/))
      }
    })
  })

  describe('collect', () => {
    afterEach(() => {
      S3.prototype.getObject.restore()
      S3.prototype.putObject.restore()
      CloudFormation.prototype.getStatusPageBucketName.restore()
      CloudWatch.prototype.getMetricData.restore()
    })

    it('should collect a datapoint and insert it', async () => {
      sinon.stub(S3.prototype, 'getObject').returns({Body: new Buffer('[]')})
      const putObjectStub = sinon.stub(S3.prototype, 'putObject').returns()
      sinon.stub(CloudFormation.prototype, 'getStatusPageBucketName').returns('')
      const timestamp = '2017-07-03T01:00:05.000Z'
      const newDatapoints = [{timestamp, value: 1}]
      const getMetricDataStub = sinon.stub(CloudWatch.prototype, 'getMetricData').returns(newDatapoints)

      const metric = genMock()
      await metric.collect()

      assert(putObjectStub.callCount === 1)
      const argsOnFirstCall = putObjectStub.args[0]
      assert(argsOnFirstCall[3].length === newDatapoints.length)
      assert(argsOnFirstCall[3][0].timestamp === timestamp.substr(0, 16) + ':00.000Z')
      assert(argsOnFirstCall[3][0].value === newDatapoints[0].value)

      const actualBegin = getMetricDataStub.args[0][1]
      const actualEnd = getMetricDataStub.args[0][2]
      const now = new Date()
      assert(actualBegin.getTime() === new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime())
      assert(actualEnd.getTime() === new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime())
    })

    it('should collect a yesterday\'s datapoint if it does not exist', async () => {
      const getObjectStub = sinon.stub(S3.prototype, 'getObject')
      getObjectStub.onCall(0).throws()
      getObjectStub.returns({Body: new Buffer('[]')})

      const putObjectStub = sinon.stub(S3.prototype, 'putObject').returns()
      sinon.stub(CloudFormation.prototype, 'getStatusPageBucketName').returns('')
      const newDatapoints = [{timestamp: '2017-07-03T01:00:05.000Z', value: 2}]
      const getMetricDataStub = sinon.stub(CloudWatch.prototype, 'getMetricData').returns(newDatapoints)

      const metric = genMock()
      await metric.collect()

      assert(putObjectStub.callCount === 2)
      const actualBegin = getMetricDataStub.args[1][1]
      const actualEnd = getMetricDataStub.args[1][2]
      const now = new Date()
      assert(actualBegin.getTime() === new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime())
      assert(actualEnd.getTime() === new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime())
    })

    it('should append to existing datapoints', async () => {
      const existingDatapoints = [{timestamp: '2017-07-03T00:00:00.000Z', value: 1}]
      sinon.stub(S3.prototype, 'getObject').returns({Body: new Buffer(JSON.stringify(existingDatapoints))})
      const putObjectStub = sinon.stub(S3.prototype, 'putObject').returns()
      sinon.stub(CloudFormation.prototype, 'getStatusPageBucketName').returns('')
      const newDatapoints = [{timestamp: '2017-07-03T01:00:00.000Z', value: 2}]
      const getMetricDataStub = sinon.stub(CloudWatch.prototype, 'getMetricData').returns(newDatapoints)

      const metric = genMock()
      await metric.collect()

      assert(putObjectStub.callCount === 1)
      const actualDatapoints = putObjectStub.args[0][3]
      assert(actualDatapoints.length === 2)
      assert(actualDatapoints[0].timestamp === existingDatapoints[0].timestamp)
      assert(actualDatapoints[1].timestamp === newDatapoints[0].timestamp)

      const actualBegin = getMetricDataStub.args[0][1]
      const actualEnd = getMetricDataStub.args[0][2]
      assert(actualBegin.toISOString() === existingDatapoints[0].timestamp)
      assert(actualEnd.toISOString() > existingDatapoints[0].timestamp)
    })

    it('should not append the datapoint if the same-timestamp data already exists', async () => {
      const existingDatapoints = [{timestamp: '2017-07-03T00:00:00.000Z', value: 1}]
      sinon.stub(S3.prototype, 'getObject').returns({Body: new Buffer(JSON.stringify(existingDatapoints))})
      const putObjectStub = sinon.stub(S3.prototype, 'putObject').returns()
      sinon.stub(CloudFormation.prototype, 'getStatusPageBucketName').returns('')
      const newDatapoints = [{timestamp: '2017-07-03T00:00:00.000Z', value: 2}]
      const getMetricDataStub = sinon.stub(CloudWatch.prototype, 'getMetricData').returns(newDatapoints)

      const metric = genMock()
      await metric.collect()

      assert(putObjectStub.callCount === 0)

      const actualBegin = getMetricDataStub.args[0][1]
      const actualEnd = getMetricDataStub.args[0][2]
      assert(actualBegin.toISOString() === existingDatapoints[0].timestamp)
      assert(actualEnd.toISOString() > existingDatapoints[0].timestamp)
    })
  })
})
