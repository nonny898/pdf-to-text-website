const express = require('express');
const bodyParser = require('body-parser');

const index = require('./routes/index');

const app = express();

app.use(
  bodyParser.raw({
    type: '*/*',
    limit: '10mb',
  })
);

app.use('/', index);

module.exports = app;
