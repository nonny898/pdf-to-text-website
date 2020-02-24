const fs = require('fs');
const path = require('path');

exports.uploadTar = (req, res, next) => {
  console.log(req.body);
  res.status(200).end();
};

exports.pdfToText = (req, res, next) => {
  // fs.readFile(path.join())
  res.status(200).end();
};
