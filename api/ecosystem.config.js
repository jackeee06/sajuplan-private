module.exports = {
  apps: [
    {
      name: 'sajumoon-api',
      script: 'dist/main.js',
      cwd: '/data/wwwroot/api.sajumoon.kr',
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
