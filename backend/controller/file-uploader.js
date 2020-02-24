const Minio = require('minio');

// Instantiate the minio client with the endpoint
// and access keys as shown below.
const minioClient = new Minio.Client({
  endPoint: '127.0.0.1',
  port: 9000,
  useSSL: false,
  accessKey: 'minioadmin',
  secretKey: 'minioadmin',
});

// File that needs to be uploaded.
const file = `${__dirname}/test.tgz`;

// Make a bucket called europetrip.
minioClient.makeBucket('europetrip', function(err) {
  if (err) return console.log(err);

  console.log('Bucket created successfully.');

  const metaData = {
    'Content-Type': 'application/octet-stream',
    'X-Amz-Meta-Testing': 1234,
    example: 5678,
  };
  // Using fPutObject API upload your file to the bucket europetrip.
  minioClient.fPutObject(
    'europetrip',
    'photos-europe.tar',
    file,
    metaData,
    function(err, etag) {
      if (err) return console.log(err);
      console.log('File uploaded successfully.');
    }
  );
});
