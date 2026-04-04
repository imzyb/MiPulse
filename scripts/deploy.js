import { existsSync, readFileSync, writeFileSync } from 'fs';
import { spawnSync } from 'child_process';
import { resolve } from 'path';

const LOCAL_CONFIG = 'wrangler.local.toml';
const DEFAULT_CONFIG = 'wrangler.toml';
const D1_BINDING = 'MIPULSE_DB';
const KV_BINDING = 'MIPULSE_KV';
const D1_RESOURCE_NAME = 'mipulse_db'; // Cloudflare resources must be lowercase
const KV_RESOURCE_NAME = 'mipulse_kv';

console.log('🚀 Starting Zero-Configuration Deployment...');

// Utility to run shell commands and capture output
function runCommand(cmd, args, options = {}) {
    const result = spawnSync(cmd, args, { 
        shell: true, 
        encoding: 'utf-8', 
        ...options 
    });
    return result;
}

// 1. Build the frontend
console.log('📦 Step 1: Building frontend...');
const buildResult = runCommand('npm', ['run', 'build'], { stdio: 'inherit' });
if (buildResult.status !== 0) {
    console.error('❌ Build failed. Aborting.');
    process.exit(1);
}

// 2. Resource Provisioning (D1 & KV)
let kvId = process.env.MIPULSE_KV_ID;
let d1Id = process.env.MIPULSE_D1_ID;

// If not in CI, try to load from wrangler.local.toml
if (!kvId || !d1Id) {
    if (existsSync(LOCAL_CONFIG)) {
        const content = readFileSync(LOCAL_CONFIG, 'utf-8');
        const kvMatch = content.match(/id\s*=\s*"([^"]+)"/);
        const d1Match = content.match(/database_id\s*=\s*"([^"]+)"/);
        if (kvMatch) kvId = kvMatch[1];
        if (d1Match) d1Id = d1Match[1];
    }
}

// Check Cloudflare Resources
console.log('🔍 Step 2: Checking Cloudflare resources...');

// A. Handle D1
if (!d1Id || d1Id.includes('your-d1')) {
    console.log(`📡 Searching for D1 database: ${D1_RESOURCE_NAME}...`);
    const d1ListResult = runCommand('npx', ['wrangler', 'd1', 'list', '--json']);
    let d1Found = false;
    
    if (d1ListResult.status === 0) {
        try {
            const d1s = JSON.parse(d1ListResult.stdout);
            const existing = d1s.find(d => d.name === D1_RESOURCE_NAME);
            if (existing) {
                d1Id = existing.uuid;
                d1Found = true;
                console.log(`✅ Found existing D1: ${d1Id}`);
            }
        } catch (e) {}
    }

    if (!d1Found) {
        console.log(`✨ Creating new D1 database: ${D1_RESOURCE_NAME}...`);
        const d1CreateResult = runCommand('npx', ['wrangler', 'd1', 'create', D1_RESOURCE_NAME, '--json']);
        if (d1CreateResult.status === 0) {
            try {
                // Some wrangler versions return JSON, some return text with "uuid"
                const output = JSON.parse(d1CreateResult.stdout);
                d1Id = output.uuid || output.database_id;
            } catch (e) {
                const match = d1CreateResult.stdout.match(/database_id\s*=\s*"([^"]+)"/) || d1CreateResult.stdout.match(/id:\s*([a-f0-9-]+)/);
                if (match) d1Id = match[1];
            }
        }
    }
    
    if (d1Id) {
        console.log(`🛠️ Initializing D1 database schema...`);
        runCommand('npx', ['wrangler', 'd1', 'execute', D1_RESOURCE_NAME, '--remote', '--file=./schema.sql'], { stdio: 'inherit' });
    }
}

// B. Handle KV
if (!kvId || kvId.includes('your-kv')) {
    console.log(`📡 Searching for KV namespace: ${KV_RESOURCE_NAME}...`);
    const kvListResult = runCommand('npx', ['wrangler', 'kv:namespace', 'list']);
    let kvFound = false;
    
    if (kvListResult.status === 0) {
        try {
            const kvs = JSON.parse(kvListResult.stdout);
            const existing = kvs.find(k => k.title && k.title.includes(KV_RESOURCE_NAME));
            if (existing) {
                kvId = existing.id;
                kvFound = true;
                console.log(`✅ Found existing KV: ${kvId}`);
            }
        } catch (e) {}
    }

    if (!kvFound) {
        console.log(`✨ Creating new KV namespace: ${KV_RESOURCE_NAME}...`);
        const kvCreateResult = runCommand('npx', ['wrangler', 'kv:namespace', 'create', KV_RESOURCE_NAME]);
        const match = kvCreateResult.stdout.match(/id\s*=\s*"([^"]+)"/);
        if (match) kvId = match[1];
    }
}

// 3. Update Local Configuration
if (kvId && d1Id) {
    const localConfigContent = `name = "mipulse"
main = "src/server/index.js"
compatibility_date = "2024-03-31"
compatibility_flags = ["nodejs_compat"]

[[d1_databases]]
binding = "${D1_BINDING}"
database_name = "${D1_RESOURCE_NAME}"
database_id = "${d1Id}"

[[kv_namespaces]]
binding = "${KV_BINDING}"
id = "${kvId}"

[assets]
directory = "./dist"
binding = "ASSETS"
not_found_handling = "single-page-application"

[triggers]
crons = ["*/1 * * * *"]
`;
    writeFileSync(LOCAL_CONFIG, localConfigContent);
    console.log(`📝 Updated local configuration: ${LOCAL_CONFIG}`);
}

// 4. Final Deployment
console.log('🚀 Step 3: Deploying to Cloudflare...');
const finalConfig = existsSync(LOCAL_CONFIG) ? LOCAL_CONFIG : DEFAULT_CONFIG;
const deployResult = runCommand('npx', ['wrangler', 'deploy', '--config', finalConfig], { stdio: 'inherit' });

if (deployResult.status === 0) {
    console.log('\n🎉 Deployment Successful!');
    console.log('------------------------------------------------------');
    console.log(`KV ID: ${kvId}`);
    console.log(`D1 ID: ${d1Id}`);
    console.log('------------------------------------------------------\n');
} else {
    console.error('❌ Deployment failed.');
    process.exit(1);
}
