module.exports = {
  apps: [
    {
      name: 'flexhunter-server',
      script: 'npm',
      args: 'start',
      cwd: '/home/flexhunter/flexhunter',
      env: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '500M',
      exp_backoff_restart_delay: 100,
    },
    {
      name: 'flexhunter-worker',
      script: 'npx',
      args: 'tsx src/server/services/jobs/worker.ts',
      cwd: '/home/flexhunter/flexhunter',
      env: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '500M',
      exp_backoff_restart_delay: 100,
    },
  ],
};
