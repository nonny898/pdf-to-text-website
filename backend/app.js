const express = require('express');
const bodyParser = require('body-parser');

const routes = require('./routes/index');

const app = express();

app.use(
  bodyParser.raw({
    type: '*/*',
  })
);

app.use('/', routes);

module.exports = app;
