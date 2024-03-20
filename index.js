const { Consumer } = require ('sqs-consumer');
const { SQSClient } = require ('@aws-sdk/client-sqs');
const mongo = require('./helpers/mongoDb_async')

const myAccessKey = process.env['AWS_ACCESS_KEY_ID'];
const mySecret = process.env['AWS_SECRET_ACCESS_KEY'];

const app = Consumer.create({
  queueUrl: 'https://sqs.eu-west-1.amazonaws.com/654654414593/AresQueue',
  // queueUrl: 'https://sqs.eu-west-1.amazonaws.com/654654414593/BBCAresQueue',
  handleMessage: async (message) => {
    let body = JSON.parse(message['Body']);
    let mes = JSON.parse(body.Message);

    //send content to MongoDB
    await mongo.writeToMongoExtended(mes);
    console.log(`Content dispatched and logs updated`)
  },
  sqs: new SQSClient({
    region: 'eu-west-1',
    credentials: {
      accessKeyId: myAccessKey,
      secretAccessKey: mySecret
    }
  })
});

app.on('error', (err) => {
  console.error(err.message);
});

app.on('processing_error', (err) => {
  console.error(err.message);
});

app.on('timeout_error', (err) => {
  console.error(err.message);
});

app.start();