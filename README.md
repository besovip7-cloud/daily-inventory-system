# 📦 نظام الجرد اليومي | Daily Inventory System

نظام جرد يومي سحابي لإدارة المخزون والمبيعات عبر 4 فروع.

---

## 🌐 الخيارات السحابية (مجانية / رخيصة)

### الخيار 1: Render.com (أسهل + مجاني) ⭐

**السيرفر (Backend + DB):**
1. سجل في [render.com](https://render.com)
2. أنشئ **PostgreSQL** جديد (Free tier)
3. أنشئ **Web Service** جديد:
   - Connect GitHub repo
   - Root Directory: `backend`
   - Build Command: `npm install`
   - Start Command: `node server.js`
4. أضف Environment Variables من قاعدة البيانات

**الواجهة (Frontend):**
1. أنشئ **Static Site** جديد
2. Root Directory: `frontend`
3. Build Command: `npm install && npm run build`
4. Publish Directory: `dist`

**الرابط:** `https://inventory-api.onrender.com/api`

---

### الخيار 2: Railway.app (مجاني + أسرع)

```bash
# 1. سجل في railway.app وثبّت CLI
npm install -g @railway/cli

# 2. ادخل للمجلد وانشر
railway login
railway init
railway add --database postgres
railway up
```

---

### الخيار 3: Vercel (Frontend) + Supabase (DB) + Render (Backend)

| الخدمة | الاستخدام | السعر |
|--------|----------|-------|
| **Vercel** | Frontend React | مجاني |
| **Supabase** | PostgreSQL DB | مجاني 500MB |
| **Render** | Backend API | مجاني |

**خطوات Supabase:**
1. سجل في [supabase.com](https://supabase.com)
2. أنشئ مشروع جديد
3. اذهب لـ Settings → Database → Connection String
4. استخدمه في `DB_HOST` في Backend

**خطوات Vercel:**
1. ربط GitHub repo
2. Framework Preset: Vite
3. Root Directory: `frontend`
4. Add Environment Variable: `VITE_API_URL=https://your-render-api.onrender.com/api`

---

### الخيار 4: VPS خاص (DigitalOcean / AWS / Hetzner)

```bash
# 1. أنشئ سيرفر Ubuntu 22.04
# 2. ثبّت Docker
sudo apt update && sudo apt install docker.io docker-compose -y

# 3. انسخ المشروع
git clone https://github.com/yourusername/daily-inventory-system.git
cd daily-inventory-system

# 4. عدّل .env
nano backend/.env

# 5. شغّل
sudo docker-compose up -d

# 6. شغّل Migration
sudo docker-compose exec backend node config/migrate.js
```

---

## 🚀 التشغيل السريع (Docker)

```bash
# 1. انسخ المشروع
git clone <repo-url>
cd daily-inventory-system

# 2. شغّل كل شيء مع Docker
docker-compose up -d

# 3. أنشئ الجداول
docker-compose exec backend node config/migrate.js

# 4. افتح المتصفح
# Frontend: http://localhost
# API: http://localhost:5000/api/health
```

---

## 📁 هيكل المشروع

```
daily-inventory-system/
├── 📁 backend/              ← API Server (Node.js + Express)
│   ├── server.js
│   ├── Dockerfile
│   ├── .env.example
│   ├── config/
│   │   ├── database.js
│   │   └── migrate.js
│   ├── controllers/
│   ├── routes/
│   ├── middleware/
│   └── utils/
│
├── 📁 frontend/             ← React App (Vite + Tailwind)
│   ├── src/
│   ├── Dockerfile
│   ├── nginx.conf
│   └── .env.example
│
├── 📁 .github/workflows/    ← CI/CD
│   └── deploy.yml
│
├── 📁 terraform/            ← AWS Infrastructure
│   ├── main.tf
│   └── variables.tf
│
├── docker-compose.yml       ← Local Full Stack
├── docker-compose.dev.yml   ← Dev Services Only
├── render.yaml              ← Render.com Config
└── vercel.json              ← Vercel Config
```

---

## 🔑 API Endpoints

| Method | Endpoint | الوصف |
|--------|----------|-------|
| `POST` | `/api/auth/login` | تسجيل الدخول |
| `GET` | `/api/branches` | الفروع |
| `GET` | `/api/branches/:id/dashboard` | لوحة التحكم |
| `GET` | `/api/inventory/items/:branchId` | مواد الفرع |
| `POST` | `/api/inventory/daily` | حفظ الجرد |
| `GET` | `/api/sales/menu` | قائمة الأصناف |
| `POST` | `/api/sales/daily` | حفظ المبيعات |
| `GET` | `/api/alerts/:branchId` | التنبيهات |
| `PUT` | `/api/alerts/:id/resolve` | حل تنبيه |
| `GET` | `/api/reports/inventory/:branchId` | تقارير |

---

## 🔔 التنبيهات الذكية

يُنشئ النظام تلقائياً:
- 🔴 **حرجة**: الكمية ≤ 50% من الحد الأدنى
- 🟡 **تحذير**: الكمية ≤ الحد الأدنى
- 🔵 **معلومات**: تذكيرات الجرد اليومي

---

## 🛡️ الأمان

- ✅ JWT Authentication
- ✅ Branch-based Authorization
- ✅ Role-based Access (Admin / Manager / Staff)
- ✅ CORS Protection
- ✅ Input Validation
- ✅ SQL Injection Protection (Parameterized Queries)

---

## 📱 PWA (تطبيق موبايل)

الواجهة تدعم:
- ✅ Responsive Design
- ✅ Offline Mode (قريباً)
- ✅ Push Notifications (قريباً)
- ✅ QR Code Scanner (قريباً)

---

## 💰 تكلفة التشغيل الشهري (تقديرية)

| الخطة | السيرفر | DB | Frontend | الإجمالي |
|-------|---------|-----|----------|---------|
| **مجانية** | Render Free | Render Free | Vercel Free | **$0** |
| **أساسية** | Render Starter ($7) | Supabase Pro ($25) | Vercel Pro ($20) | **~$52** |
| **احترافية** | DigitalOcean ($24) | Managed DB ($15) | Vercel Pro ($20) | **~$59** |

---

## 🤝 المساهمة

```bash
# Fork → Clone → Branch → PR
git checkout -b feature/new-feature
git commit -m "feat: add new feature"
git push origin feature/new-feature
```

---

## 📧 تواصل

للاستفسارات أو الدعم: [your-email@example.com]

---

<p align="center">Built with ❤️ for Saudi Restaurants</p>
