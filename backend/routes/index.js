const express = require('express');

const router = express.Router();

const tarController = require('../controller/tar');

router.post('/uploadTar', tarController.uploadTar);

module.exports = router;
