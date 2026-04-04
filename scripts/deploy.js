import { existsSync } from 'fs';
import { spawnSync } from 'child_process';
import { resolve } from 'path';

const LOCAL_CONFIG = 'wrangler.local.toml';
const DEFAULT_CONFIG = 'wrangler.toml';

console.log('🚀 Starting building and deployment process...');

// 1. Build the frontend
console.log('📦 Building frontend assets...');
const buildResult = spawnSync('npm', ['run', 'build'], { 
  shell: true, 
  stdio: 'inherit',
  cwd: process.cwd()
});

if (buildResult.status !== 0) {
  console.error('❌ Build failed. Aborting deployment.');
  process.exit(1);
}

// 2. Select configuration
const useLocalConfig = existsSync(resolve(process.cwd(), LOCAL_CONFIG));
const configToUse = useLocalConfig ? LOCAL_CONFIG : DEFAULT_CONFIG;

if (useLocalConfig) {
  console.log(`✅ Found localized configuration: ${LOCAL_CONFIG}`);
} else {
  console.log(`ℹ️ Using default configuration: ${DEFAULT_CONFIG}`);
}

// 3. Deploy
console.log(`📡 Deploying to Cloudflare Workers using ${configToUse}...`);
const deployArgs = ['wrangler', 'deploy', '--config', configToUse];

const deployResult = spawnSync('npx', deployArgs, { 
  shell: true, 
  stdio: 'inherit',
  cwd: process.cwd()
});

if (deployResult.status === 0) {
  console.log('🎉 Deployment successful!');
} else {
  console.error('❌ Deployment failed.');
  process.exit(1);
}
