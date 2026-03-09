/**
 * One-time script to migrate videos and thumbnails from Azure Blob Storage to AWS S3.
 *
 * Usage:
 *   cd backend
 *   node scripts/migrate-blobs-to-s3.js
 *
 * Prerequisites:
 *   - AZURE_STORAGE_CONNECTION_STRING set in .env (source)
 *   - AWS_REGION, AWS_S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY set in .env (destination)
 */

require('dotenv').config();
const { BlobServiceClient } = require('@azure/storage-blob');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const azureConnectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
const azureContainer = process.env.AZURE_STORAGE_CONTAINER || 'videos';

const s3Region = process.env.AWS_REGION || 'eu-south-2';
const s3Bucket = process.env.AWS_S3_BUCKET;

if (!azureConnectionString) {
    console.error('ERROR: AZURE_STORAGE_CONNECTION_STRING not set');
    process.exit(1);
}
if (!s3Bucket) {
    console.error('ERROR: AWS_S3_BUCKET not set');
    process.exit(1);
}

const blobServiceClient = BlobServiceClient.fromConnectionString(azureConnectionString);
const containerClient = blobServiceClient.getContainerClient(azureContainer);
const s3 = new S3Client({ region: s3Region });

async function migrateBlob(blobName) {
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    const downloadResponse = await blockBlobClient.download(0);
    const properties = await blockBlobClient.getProperties();

    await s3.send(new PutObjectCommand({
        Bucket: s3Bucket,
        Key: blobName,
        Body: downloadResponse.readableStreamBody,
        ContentType: properties.contentType,
        ContentLength: properties.contentLength,
    }));
}

async function migrate() {
    console.log(`Migrating blobs from Azure (${azureContainer}) → S3 (${s3Bucket})...`);

    let migrated = 0;
    let errors = 0;

    for await (const blob of containerClient.listBlobsFlat()) {
        const name = blob.name;
        process.stdout.write(`  ${name} ... `);
        try {
            await migrateBlob(name);
            console.log('OK');
            migrated++;
        } catch (err) {
            console.log(`ERROR: ${err.message}`);
            errors++;
        }
    }

    console.log('\nMigration complete:');
    console.log(`  Migrated: ${migrated}`);
    console.log(`  Errors:   ${errors}`);
}

migrate().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
});
