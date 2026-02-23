const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { v4: uuidv4 } = require('uuid');

// Use @ffmpeg-installer binary if available, otherwise assume ffmpeg is in PATH
try {
    const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
    ffmpeg.setFfmpegPath(ffmpegPath);
} catch (e) {
    // ffmpeg-installer not available, rely on system ffmpeg
}

/**
 * Generate a thumbnail from a video file.
 * Tries multiple timestamps to avoid black frames.
 * @param {string} videoPath - Path to the video file on disk
 * @returns {Promise<string|null>} Path to generated JPEG thumbnail, or null on failure
 */
async function generateThumbnail(videoPath) {
    const timestamps = ['5', '10', '15', '1', '0'];
    const outputDir = os.tmpdir();

    for (const timestamp of timestamps) {
        const outputFilename = `thumb_${uuidv4()}.jpg`;
        const outputPath = path.join(outputDir, outputFilename);

        try {
            await new Promise((resolve, reject) => {
                ffmpeg(videoPath)
                    .screenshots({
                        timestamps: [timestamp],
                        filename: outputFilename,
                        folder: outputDir,
                        size: '640x360'
                    })
                    .on('end', resolve)
                    .on('error', reject);
            });

            // Check if file was created and is not a black frame
            if (fs.existsSync(outputPath)) {
                const stats = fs.statSync(outputPath);
                // Black frames at 640x360 compress to ~2-3KB as JPEG
                if (stats.size > 5000) {
                    return outputPath;
                }
                // Likely a black frame, clean up and try next timestamp
                fs.unlinkSync(outputPath);
            }
        } catch (err) {
            // Timestamp might be beyond video duration, try next
            if (fs.existsSync(outputPath)) {
                fs.unlinkSync(outputPath);
            }
        }
    }

    return null;
}

module.exports = { generateThumbnail };
