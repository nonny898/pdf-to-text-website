const tar = require('tar');
const streamifier = require('streamifier');

exports.postUploadTar = (req, res, next) => {
  streamifier
    .createReadStream(req.body)
    .pipe(tar.t())
    .on('entry', entry => {
      console.log(entry);
    });
  res.status(200).end();
};

exports.pdfToText = (req, res, next) => {
  // fs.readFile(path.join())
  res.status(200).end();
};
