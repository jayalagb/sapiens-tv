const { S3Client, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const fs = require('fs');

const region = process.env.AWS_REGION || 'eu-south-2';
const bucket = process.env.AWS_S3_BUCKET;

let s3Client = null;

function getS3Client() {
    if (!s3Client) {
        if (!bucket) {
            throw new Error('AWS_S3_BUCKET no configurado');
        }
        s3Client = new S3Client({ region });
    }
    return s3Client;
}

async function uploadBlob(blobName, filePath) {
    const client = getS3Client();
    const fileStream = fs.createReadStream(filePath);
    await client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: blobName,
        Body: fileStream,
    }));
    return blobName;
}

async function getBlobProperties(blobName) {
    const client = getS3Client();
    const response = await client.send(new HeadObjectCommand({
        Bucket: bucket,
        Key: blobName,
    }));
    return {
        contentLength: response.ContentLength,
        contentType: response.ContentType,
    };
}

async function downloadBlobStream(blobName, offset, count) {
    const client = getS3Client();
    const range = count !== undefined
        ? `bytes=${offset}-${offset + count - 1}`
        : `bytes=${offset}-`;
    const response = await client.send(new GetObjectCommand({
        Bucket: bucket,
        Key: blobName,
        Range: range,
    }));
    return response.Body;
}

async function deleteBlob(blobName) {
    const client = getS3Client();
    await client.send(new DeleteObjectCommand({
        Bucket: bucket,
        Key: blobName,
    }));
}

async function generateSasUrl(blobName, expiresInMinutes = 60) {
    const client = getS3Client();
    const command = new GetObjectCommand({
        Bucket: bucket,
        Key: blobName,
    });
    return getSignedUrl(client, command, { expiresIn: expiresInMinutes * 60 });
}

module.exports = { uploadBlob, getBlobProperties, downloadBlobStream, deleteBlob, generateSasUrl };
