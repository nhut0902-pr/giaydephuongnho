require('dotenv').config();

const serverless = require('serverless-http');
const app = require('../../server');

const handler = serverless(app);

exports.handler = async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;
    await app.bootstrapApp();
    return handler(event, context);
};
