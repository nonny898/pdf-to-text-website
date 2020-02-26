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

const allTars = {};

const allFinishedPdf = {};

const allPdfQueue = new Bull('all-pdf-queue', {
  redis: { host: '127.0.0.1', port: 6379 },
});

allPdfQueue.process(job => {
  minioClient.getObject(
    'pdf',
    `${job.data.tar}/${job.data.name}`,
    (error, stream) => {
      if (error) {
        throw error;
      }
      streamToBuffer(stream, (error, buffer) => {
        pdf(buffer).then(data => {
          job.data.name = job.data.name.replace('.pdf', '.txt');
          minioClient.putObject(
            'pdf',
            `${job.data.tar}/${job.data.name}`,
            data.text,
            (error, result) => {
              if (error) {
                throw error;
              }
              allFinishedPdf[job.data.tar].push(job.data.name);
              if (allTars[job.data.tar].length !== 0) {
                allPdfQueue.add(allTars[job.data.tar].shift());
              } else {
                for (const file of allFinishedPdf[job.data.tar]) {
                  const writeStream = fs.createWriteStream(
                    path.join(process.cwd(), file)
                  );
                  minioClient.getObject(
                    'pdf',
                    `${job.data.tar}/${file}`,
                    (error, _stream) => {
                      _stream.pipe(writeStream);
                    }
                  );
                }
                tar
                  .c({ gzip: true }, allFinishedPdf[job.data.tar])
                  .pipe(fs.createWriteStream('my-tarball.tgz'));
                for (const file of allFinishedPdf[job.data.tar]) {
                  fs.unlink(path.join(process.cwd(), file), error => {
                    if (error) throw error;
                  });
                }
              }
            }
          );
        });
      });
    }
  );
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
              allTars[req.file.originalname] = [];
              allFinishedPdf[req.file.originalname] = [];
              const files = fs.readdirSync(
                path.join(process.cwd(), req.file.originalname)
              );
              let i = 0;
              for (const file of files) {
                await minioClient.fPutObject(
                  'pdf',
                  `${req.file.originalname}/${file}`,
                  path.join(process.cwd(), req.file.originalname, file),
                  {}
                );
                const data = {
                  name: file,
                  tar: req.file.originalname,
                };
                if (i === 0) {
                  allPdfQueue.add(data);
                } else {
                  allTars[req.file.originalname].push(data);
                }
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
});

minioClient.bucketExists('pdf', (error, exists) => {
  if (error) {
    throw error;
  }
  if (exists) {
    const server = app.listen(3000, () => {
      console.log('Listening on port %s...', server.address().port);
    });
  } else {
    minioClient.makeBucket('pdf', error => {
      if (error) {
        throw error;
      }
      const server = app.listen(3000, () => {
        console.log('Listening on port %s...', server.address().port);
      });
    });
  }
});
