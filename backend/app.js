/* eslint-disable global-require */
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
  endPoint: process.env.MINIO_HOST || '127.0.0.1',
  port: 9000,
  useSSL: false,
  accessKey: 'minioadmin',
  secretKey: 'minioadmin',
});

const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);

const allTars = {};

const allFinishedPdf = {};

minioClient.bucketExists('pdf', (error, exists) => {
  if (error) {
    throw error;
  }
  if (exists) {
    server.listen(3001, () => {
      console.log('Listening on port %s...', server.address().port);
    });
  } else {
    minioClient.makeBucket('pdf', error => {
      if (error) {
        throw error;
      }
      server.listen(3001, () => {
        console.log('Listening on port %s...', server.address().port);
      });
    });
  }
});

const allPdfQueue = new Bull('all-pdf-queue', {
  redis: { host: process.env.REDIS_HOST || '127.0.0.1', port: 6379 },
});

allPdfQueue.process(job => {
  // console.log(allTars);
  minioClient.getObject(
    'pdf',
    `${job.data.tar}/pdf/${job.data.name}`,
    (error, stream) => {
      if (error) {
        throw error;
      }
      streamToBuffer(stream, (error, buffer) => {
        pdf(buffer).then(data => {
          job.data.name = job.data.name.replace('.pdf', '.txt');
          minioClient.putObject(
            'pdf',
            `${job.data.tar}/txt/${job.data.name}`,
            data.text,
            async (error, result) => {
              if (error) {
                throw error;
              }
              allFinishedPdf[job.data.tar].push(job.data.name);
              // console.log(allFinishedPdf);
              job.progress(
                (allFinishedPdf[job.data.tar].length / job.data.length) * 100
              );
              console.log(allTars[job.data.tar].length);
              if (allTars[job.data.tar].length !== 0) {
                allPdfQueue.add(allTars[job.data.tar].shift());
              } else {
                fs.mkdirSync('txt');
                for (const file of allFinishedPdf[job.data.tar]) {
                  const writeStream = fs.createWriteStream(
                    path.join(process.cwd(), 'txt', file)
                  );
                  (await minioClient.getObject(
                    'pdf',
                    `${job.data.tar}/txt/${file}`
                  )).pipe(writeStream);
                }
                tar.c({ gzip: true, file: job.data.tar }, ['txt'], error => {
                  if (error) {
                    throw error;
                  }
                  rimraf('txt', error => {
                    if (error) throw error;
                    minioClient.fPutObject(
                      'pdf',
                      `${job.data.tar}/txt/${job.data.tar}`,
                      path.join(process.cwd(), job.data.tar),
                      {},
                      error => {
                        if (error) throw error;
                        fs.unlinkSync(path.join(process.cwd(), job.data.tar));
                      }
                    );
                  });
                });
              }
            }
          );
        });
      });
    }
  );
});

io.on('connection', socket => {
  socket.on('SEND_MESSAGE', data => {
    // console.log(data.filename);
    allPdfQueue.on('progress', (job, progress) => {
      // console.log(allTars);
      // console.log(allFinishedPdf);
      // console.log(progress);
      socket.emit(job.data.tar, {
        filename: data.filename,
        progress,
      });
      if (progress === 100) {
        // console.log(typeof job.data.tar);
        minioClient.presignedUrl(
          'GET',
          'pdf',
          `${job.data.tar}/txt/${job.data.tar}`,
          24 * 60 * 60,
          function(err, presignedUrl) {
            if (err) throw err;
            socket.emit(`${job.data.tar}-COMPLETE`, {
              url: presignedUrl,
            });
            // socket.removeAllListeners(`${job.data.tar}-COMPLETE`);
            // socket.removeAllListeners(job.data.tar);
          }
        );
      }
    });
  });
});

app.post('/upload', upload.single('pdf'), (req, res, next) => {
  minioClient.putObject(
    'pdf',
    `${req.file.originalname}/pdf/${req.file.originalname}`,
    req.file.buffer,
    error => {
      if (error) {
        return res.status(500).send(error);
      }
      minioClient.getObject(
        'pdf',
        `${req.file.originalname}/pdf/${req.file.originalname}`,
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
              // const i = 0;
              for (const file of files) {
                await minioClient.fPutObject(
                  'pdf',
                  `${req.file.originalname}/pdf/${file}`,
                  path.join(process.cwd(), req.file.originalname, file),
                  {}
                );
                const data = {
                  name: file,
                  tar: req.file.originalname,
                  length: files.length,
                };
                // if (i === 0) {
                //   allPdfQueue.add(data);
                // } else {
                // console.log(data);
                allTars[req.file.originalname].push(data);
                // }
                // i += 1;
              }
              allPdfQueue.add({
                name: files[0],
                tar: req.file.originalname,
                length: files.length,
              });
              rimraf(path.join(process.cwd(), req.file.originalname), () => {
                res.status(200).end();
              });
            });
        }
      );
    }
  );
});
