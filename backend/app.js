const express = require('express');
const multer = require('multer');
const tar = require('tar');
const fs = require('fs');
const path = require('path');

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
        async (error, stream) => {
          if (error) {
            return res.status(500).send(error);
          }
          fs.mkdirSync(path.join(process.cwd(), req.file.originalname));
          stream.pipe(
            tar.x({
              cwd: path.join(process.cwd(), req.file.originalname),
              filter: _path => {
                const regex = /^[.][_]\w+/g;
                if (regex.test(_path)) {
                  return false;
                }
                return true;
              },
            })
          );
          const files = fs.readdirSync(
            path.join(process.cwd(), req.file.originalname)
          );
          for (const file of files) {
            minioClient.fPutObject(
              'pdf',
              `${req.file.originalname}/${file}`,
              path.join(process.cwd(), req.file.originalname, file),
              {},
              (error, result) => {
                if (error) return console.log(error);
                console.log(result);
              }
            );
          }
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
