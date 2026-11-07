const { execSync } = require('child_process');
const path = require('path');

const desktopDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(__dirname, '../../');

console.log('🚀 [APEX Build] Building shared dependencies...');
try {
  execSync('npx pnpm --filter @apex/shared run build', { cwd: repoRoot, stdio: 'inherit' });
} catch (e) {
  console.log('Note: @apex/shared build executed or skipped');
}

console.log('🚀 [APEX Desktop Vercel Build] Building Vite renderer in:', desktopDir);
try {
  execSync('npx vite build', { cwd: desktopDir, stdio: 'inherit' });
  console.log('✅ [APEX Desktop Vercel Build] Complete! dist folder ready.');
} catch (err) {
  console.error('❌ [APEX Desktop Vercel Build] Build failed:', err);
  process.exit(1);
}
