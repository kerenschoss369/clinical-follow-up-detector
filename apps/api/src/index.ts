import { createApp } from './app.js';
import { config } from './config.js';
import { initDatabase } from './db/database.js';

initDatabase();

const app = createApp();

app.listen(config.port, () => {
  console.log(`API listening on http://localhost:${config.port}`);
});
