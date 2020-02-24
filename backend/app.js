const express = require('express');
const bodyParser = require('body-parser');
const routes = require('./routes/index');

const app = express();

app.use(
  bodyParser.raw({
    type: '*/*',
    limit: '10mb',
  })
);

app.use('/', routes);

module.exports = app;
