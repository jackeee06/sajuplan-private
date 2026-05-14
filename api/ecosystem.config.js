// PM2 ecosystem
//
// `cwd` 우선순위: PM2_CWD env > 현재 디렉터리(pm2 start 시점) > 테스트 서버 기본값
// deploy.sh 가 `cd $API_REMOTE && pm2 start ecosystem.config.js` 하므로 process.cwd() 가
// 자연스럽게 운영/테스트 서버 경로로 잡힌다.
module.exports = {
  apps: [
    {
      name: 'sajumoon-api',
      script: 'dist/main.js',
      cwd: process.env.PM2_CWD || process.cwd(),
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
    },
  ],
}
