import { build } from 'esbuild';
import { readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { existsSync } from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const apiDir = path.join(projectRoot, 'api');

async function findRpcHandlers(dir) {
    const results = [];
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...(await findRpcHandlers(fullPath)));
        } else if (entry.name === '[rpc].ts') {
            results.push(fullPath);
        }
    }
    return results;
}

async function main() {
    console.log('--- Bundling API RPC Handlers for Sidecar ---');

    if (!existsSync(apiDir)) {
        console.error(`API directory not found: ${apiDir}`);
        process.exit(1);
    }

    const handlers = await findRpcHandlers(apiDir);
    console.log(`Found ${handlers.length} RPC handlers to bundle.`);

    let successCount = 0;
    let failCount = 0;

    for (const tsFile of handlers) {
        const jsFile = tsFile.replace(/\.ts$/, '.js');
        const relativePath = path.relative(projectRoot, tsFile);

        try {
            await build({
                entryPoints: [tsFile],
                outfile: jsFile,
                bundle: true,
                format: 'esm',
                platform: 'node',
                target: 'node18',
                treeShaking: true,
                external: ['node:*', 'fsevents'],
            });

            const { size } = await stat(jsFile);
            const sizeKB = (size / 1024).toFixed(1);
            console.log(`OK: ${relativePath} -> ${path.basename(jsFile)} (${sizeKB} KB)`);
            successCount++;
        } catch (err) {
            console.error(`FAIL: ${relativePath}:`, err.message);
            failCount++;
        }
    }

    console.log('---------------------------------------------');
    console.log(`Summary: ${successCount} succeeded, ${failCount} failed.`);

    if (failCount > 0) process.exit(1);
}

main().catch(err => {
    console.error('Fatal build error:', err);
    process.exit(1);
});
