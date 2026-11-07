const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 [APEX Vercel Build] Starting unified build...');

function run(cmd, desc) {
  console.log(`\n📦 ${desc} (${cmd})...`);
  execSync(cmd, { stdio: 'inherit', env: { ...process.env, VERCEL: '1' } });
}

try {
  // 1. Build shared workspace libraries
  run('pnpm --filter @apex/shared build', 'Building @apex/shared');
  run('pnpm --filter @apex/incident-core build', 'Building @apex/incident-core');

  // 2. Build Mobile PWA
  run('pnpm --filter @apex/mobile run build', 'Building Mobile PWA');

  // 3. Build Desktop Assistant Web App
  run('pnpm --filter @apex/desktop run build:renderer', 'Building Desktop Web App');

  // 4. Merge Mobile PWA into Desktop dist under /mobile
  const mobileDist = path.resolve(__dirname, '../apps/mobile/dist');
  const targetMobile = path.resolve(__dirname, '../apps/desktop/dist/mobile');

  if (fs.existsSync(mobileDist)) {
    console.log(`\n📋 Merging Mobile PWA into ${targetMobile}...`);
    fs.cpSync(mobileDist, targetMobile, { recursive: true });
    console.log('✅ Mobile PWA bundled at /mobile');
  }

  console.log('\n🎉 [APEX Vercel Build] Completed successfully!');
} catch (err) {
  console.error('\n❌ [APEX Vercel Build] Build failed:', err);
  process.exit(1);
}
