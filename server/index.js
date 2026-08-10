import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import earthquakesRouter from './routes/earthquakes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/api', earthquakesRouter);
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`Caribbean Earthquake Tracker running at http://localhost:${PORT}`);
});
