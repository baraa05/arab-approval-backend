// server.js  (Node + Express)
// يعمل مع ESM (type: "module") في package.json

import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import basicAuth from 'basic-auth';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ✅ Render يمرّر المنفذ في المتغير PORT
const PORT = process.env.PORT || 3000;

// اختيار مجلد التخزين (بدون ديسك يشتغل داخل مجلد العمل)
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');

// بيانات الأدمن من Environment Variables
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || '1234';

// تأكد من وجود مجلد البيانات
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// إعدادات أساسية
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '1mb' }));

// Health check (لازم لـ Render)
app.get('/healthz', (_req, res) => res.status(200).send('ok'));

// أدوات مساعدة
const fpath = (id) => path.join(DATA_DIR, id + '.json');

// Submit order
app.post('/submit', (req, res) => {
  const body = req.body || {};
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return res.status(400).json({ ok: false, error: 'invalid' });
  }
  const id =
    'ord' +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 7);

  const order = {
    id,
    status: 'pending',
    created_at: Date.now(),
    mode: body.mode || 'pickup',
    building: body.building || '',
    notes: body.notes || '',
    items: body.items,
    items_total: body.items_total || 0,
    delivery_fee: body.delivery_fee || 0,
    final_total: body.final_total || 0,
  };

  fs.writeFileSync(fpath(id), JSON.stringify(order, null, 2));
  res.json({ ok: true, order_id: id });
});

// Check order
app.get('/check', (req, res) => {
  const id = (req.query.id || '').toString();
  const file = fpath(id);
  if (!id || !fs.existsSync(file)) return res.json({ status: 'missing' });

  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (data.status === 'approved')
    return res.json({ status: 'approved', order_number: data.number || data.id });
  if (data.status === 'rejected')
    return res.json({ status: 'rejected' });

  return res.json({ status: 'pending' });
});

// Basic auth middleware for admin
const auth = (req, res, next) => {
  const user = basicAuth(req);
  if (!user || user.name !== ADMIN_USER || user.pass !== ADMIN_PASS) {
    res.set('WWW-Authenticate', 'Basic realm="Admin"');
    return res.status(401).send('Auth required.');
  }
  next();
};

// Approve/Reject via links
app.get('/admin/action', auth, (req, res) => {
  const id = (req.query.id || '').toString();
  const act = (req.query.act || '').toString();
  const file = fpath(id);
  if (!fs.existsSync(file)) return res.redirect('/admin');

  const data = JSON.parse(fs.readFileSync(file, 'utf8'));

  if (act === 'approve' && data.status !== 'approved') {
    const seqFile = path.join(DATA_DIR, 'seq.txt');
    let n = 1000;
    if (fs.existsSync(seqFile))
      n = parseInt(fs.readFileSync(seqFile, 'utf8') || '1000', 10);
    n += 1;
    fs.writeFileSync(seqFile, String(n));
    data.status = 'approved';
    data.number = n;
  } else if (act === 'reject') {
    data.status = 'rejected';
  }

  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  res.redirect('/admin');
});

// Simple admin list
app.get('/admin', auth, (_req, res) => {
  const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith('.json'));
  const orders = files
    .map((f) => JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8')))
    .sort((a, b) => (b.created_at || 0) - (a.created_at || 0));

  const rows = orders
    .map(
      (o) => `<tr>
      <td>${o.id}</td>
      <td>${o.mode === 'delivery' ? 'توصيل' : 'استلام'} ${o.building ? ' - مبنى ' + o.building : ''}</td>
      <td>${(o.final_total || 0).toFixed(2)} JD</td>
      <td>${o.notes || ''}</td>
      <td>${o.status}</td>
      <td>${
        o.status === 'pending'
          ? `<a class="btn" href="/admin/action?act=approve&id=${o.id}">موافقة</a>
             <a class="btn danger" href="/admin/action?act=reject&id=${o.id}">رفض</a>`
          : '—'
      }</td>
    </tr>`
    )
    .join('');

  res.send(`<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8">
  <title>لوحة الموافقات</title>
  <style>
    body{font-family:ui-sans-serif,system-ui;background:#0e0e11;color:#fff;padding:24px}
    a{color:#ffab4d;text-decoration:none}
    table{width:100%;border-collapse:collapse;background:#141418;border:1px solid #333;border-radius:10px;overflow:hidden}
    th,td{padding:10px;border-bottom:1px solid #2a2a33}
    .btn{padding:6px 10px;border-radius:8px;background:#ff7a00;color:#fff;margin:0 3px;display:inline-block}
    .danger{background:#a22}
    .top{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}
  </style>
  <div class="top"><h2>طلبات بانتظار الموافقة</h2></div>
  <table>
    <tr><th>الطلب</th><th>الطريقة</th><th>الإجمالي</th><th>ملاحظات</th><th>الحالة</th><th>إجراءات</th></tr>
    ${rows || ''}
  </table>`);
});

// Root
app.get('/', (_req, res) => res.send('OK'));

// ✅ مهم: استمع على PORT من Render وعلى كل الواجهات
app.listen(PORT, '0.0.0.0', () => {
  console.log('Server running on', PORT);
});
