const express = require('express');
const multer = require('multer');
const tar = require('tar-stream');
const gunzip = require('gunzip-maybe')();

const upload = multer({ storage: multer.memoryStorage() });
const Minio = require('minio');

const minioClient = new Minio.Client({
  endPoint: '127.0.0.1',
  port: 9000,
  useSSL: false,
  accessKey: 'minioadmin',
  secretKey: 'minioadmin',
});

const app = express();

app.post('/upload', upload.single('pdf'), (req, res, next) => {
  minioClient.putObject(
    'pdf',
    `${req.file.originalname}/${req.file.originalname}`,
    req.file.buffer,
    error => {
      if (error) {
        return res.status(500).send(error);
      }
      minioClient.getObject(
        'pdf',
        `${req.file.originalname}/${req.file.originalname}`,
        (error, stream) => {
          if (error) {
            return res.status(500).send(error);
          }
          const extract = tar.extract();

          extract.on('entry', function(header, _stream, next) {
            // header is the tar header
            // stream is the content body (might be an empty stream)
            // call next when you are done with this entry

            _stream.on('end', function() {
              const regex = /^[.][_]\w+/g;
              if (regex.test(header.name)) {
                next();
              } else {
                minioClient.putObject(
                  'pdf',
                  `${req.file.originalname}/${header.name}`,
                  _stream._parent._overflow,
                  error => {
                    if (error) {
                      return res.status(500).send(error);
                    }
                    next(); // ready for next entry
                  }
                );
              }
            });

            _stream.resume(); // just auto drain the stream
          });

          extract.on('finish', function() {
            // all entries read
          });
          stream.pipe(gunzip).pipe(extract);
        }
      );
    }
  );
});

minioClient.bucketExists('pdf', (error, exists) => {
  if (error) {
    return console.log(error);
  }
  if (exists) {
    const server = app.listen(3000, () => {
      console.log('Listening on port %s...', server.address().port);
    });
  } else {
    minioClient.makeBucket('pdf', error => {
      if (error) {
        return console.log(error);
      }
      const server = app.listen(3000, () => {
        console.log('Listening on port %s...', server.address().port);
      });
    });
  }
});
