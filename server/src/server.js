import app from './app.js';
import { env } from './config/env.js';
import { connectDB } from './config/db.js';

await connectDB();

app.listen(env.port, () => {
  console.log(`Server listening on port ${env.port}`);
});
