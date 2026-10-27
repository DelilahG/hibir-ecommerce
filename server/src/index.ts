import { createApp } from './app.js';
import { config } from './config.js';
import { pool } from './db.js';

const server = createApp().listen(config.PORT, () => {
  console.log(`Hibir API listening on http://localhost:${config.PORT}`);
});

// Remove expired sessions once an hour.
const sweep = setInterval(() => {
  pool.query('DELETE FROM sessions WHERE expires_at < now()').catch((err) => console.error('session sweep failed', err));
}, 60 * 60 * 1000);
sweep.unref();

function shutdown() {
  server.close(() => pool.end().finally(() => process.exit(0)));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
