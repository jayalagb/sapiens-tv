#!/usr/bin/env node

/**
 * Backfill script: generate thumbnails for existing videos that don't have one.
 * Downloads each video from blob storage, generates a thumbnail, uploads it, and updates the DB.
 *
 * Usage: node scripts/generate-thumbnails.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/database');
const { uploadBlob, downloadBlobStream, deleteBlob } = require('../config/blobStorage');
const { generateThumbnail } = require('../utils/thumbnail');

async function downloadToTemp(blobName) {
    const ext = path.extname(blobName);
    const tempPath = path.join(os.tmpdir(), `dl_${uuidv4()}${ext}`);
    const stream = await downloadBlobStream(blobName, 0);

    return new Promise((resolve, reject) => {
        const ws = fs.createWriteStream(tempPath);
        stream.pipe(ws);
        ws.on('finish', () => resolve(tempPath));
        ws.on('error', reject);
    });
}

async function main() {
    const result = await query(
        'SELECT uid, video_url FROM videos WHERE thumbnail_url IS NULL ORDER BY created_at'
    );

    console.log(`Found ${result.rows.length} videos without thumbnails.`);

    let success = 0;
    let failed = 0;

    for (const video of result.rows) {
        console.log(`\nProcessing: ${video.uid} (${video.video_url})`);
        let tempVideoPath = null;

        try {
            // Download video to temp
            tempVideoPath = await downloadToTemp(video.video_url);
            console.log('  Downloaded to temp file.');

            // Generate thumbnail
            const thumbPath = await generateThumbnail(tempVideoPath);
            if (!thumbPath) {
                console.log('  Could not generate thumbnail (all frames were black or invalid).');
                failed++;
                continue;
            }

            // Upload thumbnail blob
            const thumbBlobName = `thumb_${video.uid}.jpg`;
            await uploadBlob(thumbBlobName, thumbPath);
            fs.unlinkSync(thumbPath);
            console.log(`  Uploaded thumbnail: ${thumbBlobName}`);

            // Update DB
            await query('UPDATE videos SET thumbnail_url = $1 WHERE uid = $2', [thumbBlobName, video.uid]);
            console.log('  Database updated.');
            success++;
        } catch (err) {
            console.error(`  Error: ${err.message}`);
            failed++;
        } finally {
            if (tempVideoPath && fs.existsSync(tempVideoPath)) {
                fs.unlinkSync(tempVideoPath);
            }
        }
    }

    console.log(`\nDone. Success: ${success}, Failed: ${failed}`);
    process.exit(0);
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
