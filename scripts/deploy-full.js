import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const WRANGLER_TOML_PATH = path.join(process.cwd(), 'wrangler.toml');
const SCHEMA_PATH = path.join(process.cwd(), 'schema.sql');

function run(cmd) {
    console.log(`\n> Executing: ${cmd}`);
    return execSync(cmd, { stdio: 'pipe' }).toString();
}

async function main() {
    try {
        console.log('🚀 MiPulse One-Click Deployment starting...');
        
        // 1. Identity Check
        console.log('--- Checking Cloudflare Identity ---');
        try {
            run('wrangler whoami');
        } catch (e) {
            console.error('❌ Error: Not logged in to Cloudflare. Please run "wrangler login" first.');
            process.exit(1);
        }

        // 2. Create D1
        console.log('\n--- Creating D1 Database ---');
        let d1Id = '';
        try {
            const d1Output = run('wrangler d1 create MIPULSE_DB');
            const match = d1Output.match(/database_id = "([^"]+)"/);
            if (match) d1Id = match[1];
        } catch (e) {
            if (e.message.includes('already exists')) {
                console.log('ℹ️ MIPULSE_DB already exists. Please ensure database_id is correct in wrangler.toml manually if this is a re-run.');
            } else {
                throw e;
            }
        }

        // 3. Create KV
        console.log('\n--- Creating KV Namespace ---');
        let kvId = '';
        try {
            const kvOutput = run('wrangler kv:namespace create MIPULSE_KV');
            const match = kvOutput.match(/id = "([^"]+)"/);
            if (match) kvId = match[1];
        } catch (e) {
            if (e.message.includes('already exists')) {
                console.log('ℹ️ MIPULSE_KV already exists.');
            } else {
                throw e;
            }
        }

        // 4. Update wrangler.toml
        console.log('\n--- Updating wrangler.toml ---');
        let toml = fs.readFileSync(WRANGLER_TOML_PATH, 'utf8');
        
        if (d1Id) {
            toml = toml.replace(/database_id = "00000000-0000-0000-0000-000000000000"/, `database_id = "${d1Id}"`);
            console.log(`✅ Updated D1 ID: ${d1Id}`);
        }
        if (kvId) {
            toml = toml.replace(/id = "00000000000000000000000000000000"/, `id = "${kvId}"`);
            console.log(`✅ Updated KV ID: ${kvId}`);
        }
        
        fs.writeFileSync(WRANGLER_TOML_PATH, toml);

        // 5. Initialize Schema
        if (d1Id || toml.includes('database_id =')) {
            console.log('\n--- Initializing D1 Schema ---');
            run('wrangler d1 execute MIPULSE_DB --file=./schema.sql --remote');
        }

        // 6. Build and Deploy
        console.log('\n--- Building and Deploying ---');
        run('npm run build');
        run('wrangler deploy');

        console.log('\n✨ MiPulse Deployment Successful!');
        console.log('👉 Dashboard: https://mipulse.<your-subdomain>.workers.dev');
        console.log('👉 Login: /login (admin / mipulse-secret)');

    } catch (error) {
        console.error('\n❌ Deployment Failed:');
        console.error(error.message);
        if (error.stdout) console.error(error.stdout.toString());
        process.exit(1);
    }
}

main();
