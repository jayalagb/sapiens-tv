const { BlobServiceClient } = require('@azure/storage-blob');

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
const containerName = process.env.AZURE_STORAGE_CONTAINER || 'videos';

let containerClient = null;

function getContainerClient() {
    if (!containerClient) {
        if (!connectionString) {
            throw new Error('AZURE_STORAGE_CONNECTION_STRING no configurado');
        }
        const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
        containerClient = blobServiceClient.getContainerClient(containerName);
    }
    return containerClient;
}

async function uploadBlob(blobName, filePath) {
    const client = getContainerClient();
    const blockBlobClient = client.getBlockBlobClient(blobName);
    await blockBlobClient.uploadFile(filePath);
    return blobName;
}

async function getBlobProperties(blobName) {
    const client = getContainerClient();
    const blockBlobClient = client.getBlockBlobClient(blobName);
    const properties = await blockBlobClient.getProperties();
    return {
        contentLength: properties.contentLength,
        contentType: properties.contentType
    };
}

async function downloadBlobStream(blobName, offset, count) {
    const client = getContainerClient();
    const blockBlobClient = client.getBlockBlobClient(blobName);
    const response = await blockBlobClient.download(offset, count);
    return response.readableStreamBody;
}

async function deleteBlob(blobName) {
    const client = getContainerClient();
    const blockBlobClient = client.getBlockBlobClient(blobName);
    await blockBlobClient.deleteIfExists();
}

module.exports = { uploadBlob, getBlobProperties, downloadBlobStream, deleteBlob };
