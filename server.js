import 'dotenv/config';
import express from 'express';
import { Pool } from 'pg';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT || 3000);
const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : new Pool({
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT || 5432),
      database: process.env.DB_NAME || 'autocore',
      user: process.env.DB_USER || 'autocore',
      password: process.env.DB_PASSWORD,
    });
const serviceCodes = new Set(['diagnostics', 'maintenance', 'suspension', 'electrics', 'engine']);

app.use(express.json({ limit: '32kb' }));
app.get('/', (_req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// This confirms that the Node server is running. Database availability is
// checked separately at /api/health so hosting startup is not blocked by DB init.
app.get('/healthz', (_req, res) => res.status(200).send('ok'));

function clean(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function newRequestNumber() {
  return `AC-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
}

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  } catch {
    res.status(503).json({ ok: false, message: 'PostgreSQL недоступен.' });
  }
});

app.post('/api/requests', async (req, res, next) => {
  const name = clean(req.body.name, 120);
  const phone = clean(req.body.phone, 30);
  const car = clean(req.body.car, 120);
  const plate = clean(req.body.plate, 30) || null;
  const service = clean(req.body.service, 30);
  const preferredDate = clean(req.body.date, 10);
  const details = clean(req.body.details, 1500) || null;

  if (!name || !phone || !car || !serviceCodes.has(service) || !/^\d{4}-\d{2}-\d{2}$/.test(preferredDate)) {
    return res.status(400).json({ message: 'Проверьте обязательные поля формы.' });
  }

  try {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const requestNumber = newRequestNumber();
      try {
        await pool.query(
          `INSERT INTO autoservice.website_requests
            (request_number, customer_name, phone, car, license_plate, service_code, preferred_date, details)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [requestNumber, name, phone, car, plate, service, preferredDate, details]
        );
        return res.status(201).json({ requestNumber, status: 'Заявка принята' });
      } catch (error) {
        if (error.code !== '23505' || attempt === 2) throw error;
      }
    }
  } catch (error) {
    next(error);
  }
});

app.get('/api/requests/:requestNumber', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT request_number, car, service_code, preferred_date, status
       FROM autoservice.website_requests WHERE request_number = $1`,
      [clean(req.params.requestNumber, 20).toUpperCase()]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Заявка с таким номером не найдена.' });
    const request = rows[0];
    res.json({ requestNumber: request.request_number, car: request.car, service: request.service_code, preferredDate: request.preferred_date.toISOString().slice(0, 10), status: request.status });
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ message: 'Ошибка сервера. Проверьте подключение к PostgreSQL и миграцию database.sql.' });
});

app.listen(port, () => console.log(`AutoCore is running on http://localhost:${port}`));
