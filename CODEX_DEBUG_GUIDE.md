<div dir="rtl" align="right">

# 📑 تقرير المشكلة التقني للـ Admin Panel والدليل الإرشادي (Codex Debugging Guide)

**الإصدار الحالي للنظام:** `v2.27.8`  
**تاريخ التقرير:** 11 أغسطس 2026  
**البيئة التشغيلية:** 
- Frontend: Firebase Hosting (`https://fawterx.web.app`)
- Backend: Render Express.js Node.js Server (`https://fawterx-api.onrender.com/api`)
- Database & Auth: Firebase Auth & Firestore

---

## 🎯 1. ملخص المشكلة الرئيسي (Issue Summary)

### المشكلة الأولى: عدم تحميل لوحة الإدارة (`Admin Panel Failure`)
- **العرض (Symptom):** عند فتح صفحة لوحة الإدارة `/admin` أو تحديث الصفحة أثناء وجود المستخدم الإداري (`gemy.essam.ge@gmail.com`)، يظهر خطأ الإشعار: **"فشل تحميل لوحة الإدارة"** ولا تظهر إحصائيات المستخدمين أو القائمة.
- **التشخيص الأول:** الطلبات الصادرة من الواجهة كـ `GET /api/admin/stats` و `GET /api/admin/users` ترجع إما خطأ `401 Unauthorized` أو `403 Forbidden` أو `500 Internal Server Error`.
- **السبب المحتمل:** 
  1. عدم انتماك/وصول الـ `Authorization: Bearer <token>` المحدث من Firebase Auth في الوقت المناسب (Race condition بين تحميل `auth.currentUser` واستدعاء `useEffect` في `AdminPanel.jsx`).
  2. فشل الـ backend في التحقق من التوكن عند استخدام `admin.auth().verifyIdToken(token)` بسبب قيود الشبكة أو بيئة الخدمة على Render.
  3. محاولة استدعاء `admin.auth().listUsers()` في `adminStore.js` والتي قد ترمي استثناء يسبب فشل استجابة السيرفر إذا لم تكن صلاحيات حساب الخدمة مكتملة.

### المشكلة الثانية: تعطل دليل الخطوات (`Step Guide Modal Failure`)
- **العرض:** زر **"💡 دليل الخطوات"** في الشريط العلوي لا يفتح النافذة الإرشادية في بعض الصفحات.

---

## 📁 2. الهيكل البرمجي والملفات المعنية (Affected Files Map)

```
FawterX/
├── backend/
│   ├── src/
│   │   ├── middleware/auth.js        # برمجيات التحقق من هوية المستخدم والـ Token
│   │   ├── routes/admin.js           # المسارات والـ Middleware لـ Admin Panel (/api/admin/*)
│   │   ├── services/adminStore.js    # استعلامات Firestore و Firebase Admin Auth لجلب الإحصائيات
│   │   └── services/adminAccess.js   # التحقق من البريد الإلكتروني المعتمد للأدمن
├── frontend/
│   ├── src/
│   │   ├── pages/AdminPanel.jsx      # واجهة لوحة الإدارة وجلب البيانات
│   │   ├── components/StepGuideModal.jsx # مكون دليل الخطوات التفصيلي
│   │   ├── services/api.js           # تكوين Axios وتمرير التوكن في الـ Interceptors
│   │   └── App.jsx                   # مسارات التطبيق وسياق المستخدم الرئيسي (AppContext)
```

---

## 🔍 3. التفاصيل البرمجية الحالية وكيفية التتبع (Technical Code Details)

### 1. جلب البيانات في الواجهة (`frontend/src/pages/AdminPanel.jsx`)

```javascript
// AdminPanel.jsx
const ADMIN_EMAIL = 'gemy.essam.ge@gmail.com';

export default function AdminPanel() {
  const { lang, user } = useContext(AppContext);
  const isAdmin = (user?.email || '').toLowerCase() === ADMIN_EMAIL;

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    loadData();
  }, [isAdmin]);

  async function loadData() {
    setLoading(true);
    try {
      const statsRes = await getAdminStats().catch(err => {
        console.warn('Stats fetch error:', err);
        return null;
      });
      const usersRes = await getAdminUsers().catch(err => {
        console.warn('Users fetch error:', err);
        return null;
      });

      if (statsRes?.success && statsRes.stats) {
        setStats(statsRes.stats);
      }
      if (usersRes?.success && usersRes.users) {
        setUsers(usersRes.users);
      }
      if (!statsRes?.success && !usersRes?.success) {
        toast.error(t.loadingError); // "فشل تحميل لوحة الإدارة"
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }
}
```

---

### 2. اعتراض الطلبات وتمرير الـ Token (`frontend/src/services/api.js`)

```javascript
// api.js
api.interceptors.request.use(async (config) => {
  try {
    const useQuickLogin = localStorage.getItem('useQuickLogin') === 'true';
    if (useQuickLogin) {
      config.headers['Authorization'] = 'Bearer BYPASS_EXPRESS_LOGIN_SECRET_TOKEN_CHOCO_EGYPT_9988';
    } else {
      const user = auth.currentUser;
      if (user) {
        const token = await user.getIdToken();
        config.headers['Authorization'] = `Bearer ${token}`;
      } else {
        const savedToken = localStorage.getItem('fawterx_id_token');
        if (savedToken) {
          config.headers['Authorization'] = `Bearer ${savedToken}`;
        }
      }
    }
    return config;
  } catch (err) {
    return config;
  }
});
```

---

### 3. المصادقة والتحقق في السيرفر (`backend/src/middleware/auth.js`)

```javascript
// auth.js
module.exports = async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    if (process.env.NODE_ENV !== "production") {
      req.user = { uid: "mock-saas-user-uid", email: "gemy.essam.ge@gmail.com", name: "GeMy (المدير)" };
      req.user.isAdmin = true;
      return next();
    }
    return res.status(401).json({ success: false, message: "غير مصرح بالدخول: يجب توفير Firebase ID Token" });
  }

  const token = authHeader.split(" ")[1];

  if (token === "BYPASS_EXPRESS_LOGIN_SECRET_TOKEN_CHOCO_EGYPT_9988") {
    req.user = {
      uid: "admin-primary-account",
      email: "gemy.essam.ge@gmail.com",
      name: "GeMy (المدير الرئيسي)",
    };
    req.user.isAdmin = true;
    return next();
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    const userEmail = String(decodedToken.email || "").toLowerCase().trim();
    req.user = {
      uid: decodedToken.uid,
      email: userEmail,
      name: decodedToken.name || userEmail,
    };
    req.user.isAdmin = isAdminEmail(userEmail) || userEmail === "gemy.essam.ge@gmail.com";
    next();
  } catch (error) {
    // JWT Fallback Payload decode if verifyIdToken fails
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
        const userEmail = String(payload.email || "").toLowerCase().trim();
        req.user = {
          uid: payload.user_id || payload.sub || "decoded-user",
          email: userEmail,
          name: payload.name || userEmail,
        };
        req.user.isAdmin = isAdminEmail(userEmail) || userEmail === "gemy.essam.ge@gmail.com";
        return next();
      }
    } catch (e) {}
    return res.status(401).json({ success: false, message: "جلسة غير صالحة" });
  }
};
```

---

### 4. حماية مسارات الإدارة (`backend/src/routes/admin.js`)

```javascript
// admin.js
function requireAdmin(req, res, next) {
  const userEmail = String(req.user?.email || "").toLowerCase().trim();
  const isAdmin = req.user?.isAdmin || isAdminEmail(userEmail) || userEmail === "gemy.essam.ge@gmail.com" || req.user?.uid === "admin-primary-account";
  if (!req.user || !isAdmin) {
    return res.status(403).json({
      success: false,
      message: "Forbidden: admin access is restricted to the approved administrator account.",
    });
  }
  return next();
}
```

---

## 🛠️ 4. المتطلبات المطلوبة من Codex لحل المشكلة بالكامل (Fix Instructions for Codex)

1. **إصلاح تزامن جلب توكن المصادقة (Auth State Synchronization):**
   - تعديل `AdminPanel.jsx` أو `api.js` بحيث يضمن أن طلبات `getAdminStats()` و `getAdminUsers()` تصدر **فقط بعد تأكيد جاهزية حالة المستخدم وتوفر الـ Token** (باستخدام `auth.onAuthStateChanged` أو تأكيد الـ `user` في `App.jsx`).

2. **معالجة استثناءات السيرفر لجلب القائمة (`adminStore.js` Error Handling):**
   - التأكد من أن دالة `listUsers()` و `getAdminStats()` في `backend/src/services/adminStore.js` لا تفشل حتى لو تعذر الوصول لـ Firebase Auth Bulk List، وأن تُرجع دائماً كائن البيانات الافتراضي بدون رمي خطأ HTTP 500.

3. **إعادة تفعيل الدليل الإرشادي (Global Step Guide Integration):**
   - تأكيد فتح `StepGuideModal` من زر الشريط العلوي واستخدامه للحالة العامة `showTutorialModal` المتاحة عبر `AppContext`.

---

</div>
