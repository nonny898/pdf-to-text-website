const tar = require('tar');
const streamifier = require('streamifier');
const path = require('path');
const fs = require('fs');

exports.postUploadTar = (req, res, next) => {
  const fldExists = fs.existsSync(path.join(process.cwd(), 'pdf'));
  if (fldExists) {
    streamifier
      .createReadStream(req.body)
      .pipe(tar.x({ C: path.join(process.cwd(), 'pdf') }));
    res.status(200).end();
  }
  res.status(404).end();
};
