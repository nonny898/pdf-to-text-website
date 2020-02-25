const express = require('express');
const multer = require('multer');
const tar = require('tar');
const fs = require('fs');
const path = require('path');
const rimraf = require('rimraf');
const Bull = require('bull');
const pdf = require('pdf-parse');
const streamToBuffer = require('stream-to-buffer');

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

const myFirstQueue = new Bull('my-first-queue', {
  redis: { host: '127.0.0.1', port: 6379 },
});

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
          if (!fs.existsSync(path.join(process.cwd(), req.file.originalname))) {
            fs.mkdirSync(path.join(process.cwd(), req.file.originalname));
          }
          stream
            .pipe(
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
            )
            .on('finish', async () => {
              const files = fs.readdirSync(
                path.join(process.cwd(), req.file.originalname)
              );
              let i = 1;
              for (const file of files) {
                myFirstQueue.add({ name: file }, { priority: i });
                await minioClient.fPutObject(
                  'pdf',
                  `${req.file.originalname}/${file}`,
                  path.join(process.cwd(), req.file.originalname, file),
                  {}
                );
                i += 1;
              }
              rimraf(path.join(process.cwd(), req.file.originalname), () => {
                res.status(200).end();
              });
            });
        }
      );
    }
  );
  myFirstQueue.process(job => {
    minioClient.getObject(
      'pdf',
      `${req.file.originalname}/${job.data.name}`,
      (error, stream) => {
        if (error) {
          return res.status(500).end();
        }
        streamToBuffer(stream, (error, buffer) => {
          pdf(buffer).then(data => {
            job.data.name = job.data.name.replace('.pdf', '.txt');
            minioClient.putObject(
              'pdf',
              `${req.file.originalname}/${job.data.name}`,
              data.text,
              (error, result) => {
                if (error) {
                  return res.status(500).send(error);
                }
              }
            );
          });
        });
      }
    );
  });
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
