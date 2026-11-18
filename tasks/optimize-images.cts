/**
 * optimize-images.cts
 *
 * 1. Normalises the photos the tracker and the CMS commit (images/races,
 *    images/runners) in public/: anything over a long edge or byte limit is
 *    scaled down and re-encoded as JPEG, dropping EXIF (GPS included). The
 *    tracker already shrinks before upload; this catches everything else
 *    (old uploads, CMS uploads, PNG exports saved as .jpg).
 * 2. Generates OG image variants for social sharing: 1200×630 JPEG at 80%.
 */
import * as fs from 'fs';
import * as path from 'path';
import type { TaskDef } from 'skier/dist/types';

const sharp = require('sharp');

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;
const OG_QUALITY = 80;
const SUPPORTED_EXTENSIONS = ['.jpg', '.jpeg', '.png'];

/** Photo dirs (under public/images) and the long edge each is served at. */
const NORMALISE_DIRS: Array<{ dir: string; maxEdge: number }> = [
    { dir: 'races', maxEdge: 1920 },
    { dir: 'runners', maxEdge: 640 },
];
const NORMALISE_MAX_BYTES = 800 * 1024;
const NORMALISE_QUALITY = 82;

async function normalisePhotos(projectRoot: string, logger: { info(m: string): void; error(m: string): void }) {
    for (const { dir, maxEdge } of NORMALISE_DIRS) {
        const abs = path.join(projectRoot, 'public/images', dir);
        if (!fs.existsSync(abs)) continue;
        for (const file of fs.readdirSync(abs)) {
            const filePath = path.join(abs, file);
            if (!SUPPORTED_EXTENSIONS.includes(path.extname(file).toLowerCase())) continue;
            if (fs.statSync(filePath).isDirectory()) continue;
            try {
                const inputSize = fs.statSync(filePath).size;
                const meta = await sharp(filePath).metadata();
                // EXIF orientation 5-8 swaps width and height.
                const longEdge = Math.max(meta.width ?? 0, meta.height ?? 0);
                if (longEdge <= maxEdge && inputSize <= NORMALISE_MAX_BYTES) continue;
                const out: Buffer = await sharp(filePath)
                    .rotate() // apply EXIF orientation before metadata is dropped
                    .resize(maxEdge, maxEdge, { fit: 'inside', withoutEnlargement: true })
                    .flatten({ background: '#ffffff' })
                    .jpeg({ quality: NORMALISE_QUALITY, mozjpeg: true })
                    .toBuffer();
                fs.writeFileSync(filePath, out);
                logger.info(`Normalised: ${dir}/${file} (${formatBytes(inputSize)} → ${formatBytes(out.length)})`);
            } catch (err) {
                logger.error(`Failed to normalise ${dir}/${file}: ${(err as Error).message}`);
            }
        }
    }
}

export const createOptimizeImagesTask = (): TaskDef<{}, void> => ({
    name: 'optimize-images',
    title: 'Normalise uploaded photos and generate OG images',
    config: {},
    run: async (_, { logger }) => {
        const projectRoot = process.cwd();
        await normalisePhotos(projectRoot, logger);

        const racesDir = path.join(projectRoot, 'public/images/races');
        const ogDir = path.join(racesDir, 'og');

        if (!fs.existsSync(racesDir)) {
            logger.info('No races image directory found, skipping OG image generation');
            return;
        }

        // Ensure output directory exists
        fs.mkdirSync(ogDir, { recursive: true });

        const files = fs.readdirSync(racesDir).filter(f => {
            const ext = path.extname(f).toLowerCase();
            return SUPPORTED_EXTENSIONS.includes(ext) && !fs.statSync(path.join(racesDir, f)).isDirectory();
        });

        if (files.length === 0) {
            logger.info('No race images found to optimize');
            return;
        }

        let processedCount = 0;

        for (const file of files) {
            const inputPath = path.join(racesDir, file);
            // Always output as .jpg
            const outputName = path.basename(file, path.extname(file)) + '.jpg';
            const outputPath = path.join(ogDir, outputName);

            try {
                await sharp(inputPath)
                    .resize(OG_WIDTH, OG_HEIGHT, {
                        fit: 'cover',
                        position: 'centre',
                    })
                    .jpeg({ quality: OG_QUALITY })
                    .toFile(outputPath);

                const inputSize = fs.statSync(inputPath).size;
                const outputSize = fs.statSync(outputPath).size;
                const reduction = Math.round((1 - outputSize / inputSize) * 100);

                logger.info(
                    `Optimized: ${file} → og/${outputName} (${formatBytes(inputSize)} → ${formatBytes(outputSize)}, ${reduction}% smaller)`
                );
                processedCount++;
            } catch (err) {
                logger.error(`Failed to optimize ${file}: ${(err as Error).message}`);
            }
        }

        // Also process any images in the root images directory that are used as mainPhoto
        const imagesDir = path.join(projectRoot, 'public/images');
        const rootOgDir = path.join(imagesDir, 'og');
        fs.mkdirSync(rootOgDir, { recursive: true });

        const rootImages = fs.readdirSync(imagesDir).filter(f => {
            const ext = path.extname(f).toLowerCase();
            return SUPPORTED_EXTENSIONS.includes(ext) && !fs.statSync(path.join(imagesDir, f)).isDirectory();
        });

        for (const file of rootImages) {
            const inputPath = path.join(imagesDir, file);
            const outputName = path.basename(file, path.extname(file)) + '.jpg';
            const outputPath = path.join(rootOgDir, outputName);

            try {
                await sharp(inputPath)
                    .resize(OG_WIDTH, OG_HEIGHT, {
                        fit: 'cover',
                        position: 'centre',
                    })
                    .jpeg({ quality: OG_QUALITY })
                    .toFile(outputPath);

                const inputSize = fs.statSync(inputPath).size;
                const outputSize = fs.statSync(outputPath).size;
                const reduction = Math.round((1 - outputSize / inputSize) * 100);

                logger.info(
                    `Optimized: ${file} → og/${outputName} (${formatBytes(inputSize)} → ${formatBytes(outputSize)}, ${reduction}% smaller)`
                );
                processedCount++;
            } catch (err) {
                logger.error(`Failed to optimize ${file}: ${(err as Error).message}`);
            }
        }

        logger.info(`OG image optimization complete. Processed ${processedCount} images.`);
    },
});

function formatBytes(bytes: number): string {
    if (bytes < 1024) return bytes + 'B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
    return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
}
