module.exports = {
  apps: [
    {
      name: 'product-sync',
      script: 'server/aliexpress_product_sync_worker.mjs',
      instances: 1,
      exec_mode: 'cluster',
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        LOG_LEVEL: 'info',
        SYNC_INTERVAL: '1800000', // 30 minutes
      },
      error_file: 'logs/product-sync-error.log',
      out_file: 'logs/product-sync-out.log',
      log_file: 'logs/product-sync-combined.log',
      time: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
    },
  ],
};
