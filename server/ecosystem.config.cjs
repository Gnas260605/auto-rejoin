module.exports = {
  apps: [
    {
      name: 'auto-rejoin-api',
      script: 'src/server.js',
      instances: 'max',
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '350M',
      restart_delay: 3000,
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      time: true,
      error_file: '/var/log/auto-rejoin/api-error.log',
      out_file: '/var/log/auto-rejoin/api-out.log',
      merge_logs: true,
      listen_timeout: 10000,
      kill_timeout: 5000
    }
  ]
};
