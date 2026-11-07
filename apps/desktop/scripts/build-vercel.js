const { execSync } = require('child_process');

console.log('🚀 [APEX Desktop Vercel Build] Building Vite renderer...');
try {
  execSync('npx vite build', { stdio: 'inherit' });
  console.log('✅ [APEX Desktop Vercel Build] Complete! dist folder ready.');
} catch (err) {
  console.error('❌ [APEX Desktop Vercel Build] Build failed:', err);
  process.exit(1);
}
