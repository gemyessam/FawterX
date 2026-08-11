<div align="right" dir="rtl" style="text-align: right; direction: rtl;">

# 📘 الدليل المعماري والهندسي الشامل لمنصة FawterX (v2.26.4)

مرحباً بك يا بطل! هذا الدليل مصمم لك خصيصاً كـ **المؤسس والمهندس الرئيسي للمشروع** لتفهم الكود والتقنيات المستخدمة من البداية وحتى التقديم الفعلي على بورتال الضرائب المصرية (ETA).

---

<h2 align="right">🎯 1. التحدي والحل التقني (The Problem & Solution)</h2>

<h3 align="right">❌ المشكلة قبل FawterX:</h3>
مصلحة الضرائب المصرية (**ETA - Egyptian Tax Authority**) تفرض على الشركات تقديم كافة الفواتير بصيغة رقمية مجهزة بشروط صارمة:
- تكويد موحد (EGS / GS1).
- حسابات الضرائب والخصوم بدقة تصل لـ 4 أرقام عشرية.
- توقيع إلكتروني ملموس باستعمال USB Token (تشفير CAdES-BES).
- هيكل JSON معقد ومطابق تماماً للمواصفات المعمارية للضرائب.

عندما تصدر شركة (مثل **Schüco** أو **Canex**) فواتيرها عبر ملفات **Excel / Commercial Invoices** ضخمة تحتوي على مئات البنود، كانت عملية الإدخال اليدوي تسحب أياماً وتتسبب في خطأ بشري يرفضه البورتال.

<h3 align="right">✅ الحل في FawterX:</h3>
منصة **SaaS ذكية** تعمل كبديل خفيف لنظم الـ ERP:
1. رفع ملف الإكسيل مباشرة كما هو بدون الحاجة لإعادة الترتيب مرتين.
2. تحليل ذكي مع تصفية تلقائية لصفوف الإجماليات (Summary Footers) لعدم تكرار البنود.
3. ربط الفواتير بـ **موديول المخازن (Warehouse Module)** لتحديث حركة التوريد أو الخصم تلقائياً.
4. التوقيع التلقائي وإرسال الفواتير لـ ETA REST API بنسبة قبول **100%**.

---

<h2 align="right">🛠️ 2. التقنيات المستخدمة ولماذا تم اختيارها (Tech Stack & Rationale)</h2>

<table align="right" dir="rtl" style="width: 100%; text-align: right;">
  <thead>
    <tr>
      <th align="right">التقنية</th>
      <th align="right">الدور في المشروع</th>
      <th align="right">سبب الاختيار والتفوق التقني</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td align="right"><b>React 18 + Vite</b></td>
      <td align="right">الواجهة الأمامية (Frontend)</td>
      <td align="right">سرعة بناء واستجابة فائقة (HMR)، وإدارة حالة الكود بسلاسة دون ثقل الفريموركات التقليدية.</td>
    </tr>
    <tr>
      <td align="right"><b>Vanilla CSS + Glassmorphism</b></td>
      <td align="right">التصميم والتنسيق (Styling)</td>
      <td align="right">إعطاء المنصة مظهر هجين وفاخر جداً (Dark Mode + Neon Badges) يبهر العميل دون الاعتماد على Tailwind.</td>
    </tr>
    <tr>
      <td align="right"><b>Node.js + Express</b></td>
      <td align="right">الخادم الخلفي (Backend)</td>
      <td align="right">خفيف، سريع جداً في معالجة طلبات الـ I/O والتحليل المباشر لملفات الإكسيل وتحويل البيانات لـ JSON.</td>
    </tr>
    <tr>
      <td align="right"><b>XLSX (SheetJS)</b></td>
      <td align="right">قراءة ملفات Excel</td>
      <td align="right">مكتبة عالية الكفاءة مكنتنا من استخراج الجداول وحسابات البنود من شيتات الإكسيل بسرعة الخاطف.</td>
    </tr>
    <tr>
      <td align="right"><b>Firebase Auth & Firestore</b></td>
      <td align="right">التوثيق وقواعد البيانات</td>
      <td align="right">توثيق سريع بـ Google Sign-In وإدارة بيانات فائقة السرعة بدون الحاجة لإدارة سيرفرات SQL معقدة.</td>
    </tr>
    <tr>
      <td align="right"><b>C# (.NET) / CAdES-BES</b></td>
      <td align="right">برنامج التوقيع (FawterX Signer)</td>
      <td align="right">التواصل المباشر مع تعريفات الـ Windows Cryptographic Service Provider (CSP) لاستخراج شهادة الـ USB Token وتوقيع الفواتير.</td>
    </tr>
    <tr>
      <td align="right"><b>Firebase Hosting</b></td>
      <td align="right">استضافة الواجهة الأمامية</td>
      <td align="right">استضافة مجانية، سريعة، ومحمية بـ CDN عالمي للفلايرز والـ Frontend.</td>
    </tr>
    <tr>
      <td align="right"><b>Render</b></td>
      <td align="right">استضافة Node.js Backend</td>
      <td align="right">تشغيل السيرفر الخلفي 24/7 مع دعم التحديث التلقائي فور الـ <code>git push</code>.</td>
    </tr>
  </tbody>
</table>

<br/><br/>

---

<h2 align="right">🏗️ 3. الأجزاء الرئيسية للكود وكيف تعمل (Core Code Structure)</h2>

<h3 align="right">أ. الواجهة الأمامية (Frontend Architecture)</h3>

1. **`App.jsx`**:
   - يحتوي على الـ **Routing** المترجم بيئياً بالكامل.
   - يدير الـ **AppContext** والـ **SettingsContext** لمشاركة بيانات اللغة (عربي/إنجليزي)، المستخدم الحالي، وبيانات الـ Credentials المشفرة.
   - يضم الهيدر الذكي مع **سلوجان الاعتماد الأخضر الثابت** وشارة رقم الإصدار (`v2.26.4 ✨`) التي تفتح **ReleaseNotesModal**.

2. **`ReleaseNotesModal.jsx`**:
   - مكون تفاعلي يعرض سجل الإصدارات والتحديثات التاريخية بالكامل للمستخدمين لتعزيز الشفافية والموثوقية.

3. **`Home.jsx`**:
   - واجهة رفع الإكسيل وتحويله المباشر، وتتيح للمستخدم مراجعة البنود والضرائب وتعيين الأسعار والخصومات قبل التقديم.

4. **`Warehouse.jsx`**:
   - موديول إدارة المخزون الكامل: يربط الفواتير بإنشاء مشاريع ومخازن، ويتحكم بحركات التوريد (Inbound) والخصم (Outbound)، مع نظام صلاحيات دقيق للمستخدمين والمديرين.

---

<h3 align="right">ب. الخادم الخلفي (Backend Architecture)</h3>

1. **`smartParser.js` & `excelParser.js`**:
   - **القلب النابض للمحلل:** يقرأ ملف الإكسيل، يحدد الهيدر (رقم الفاتورة، تاريخ التوريد، اسم العميل، الـ PO/SO Ref)، ثم يمر على الصفوف واستخراج البنود.
   - يحتوي على خوارزميات ذكية لاستبعاد صفوف الملخصات مثل (`Total`, `Subtotal`, `إجمالي الفاتورة`) لضمان عدم تكرار الحسابات.

2. **`etaMapper.js` & `etaValidator.js`**:
   - **المحوّل الضريبي:** يحول البيانات الخام إلى صيغة **ETA Canonical JSON Framework**.
   - يحسب ضريبة القيمة المضافة (T1 / V009 أو T1 / V001) بدقة 4 أرقام عشرية، ويضمن وجود جميع الحقول المطلوبة لمنع رفض الفاتورة من سيرفر الضرائب.

3. **`warehouseStore.js`**:
   - مسؤول عن حفظ البيانات في قواعد Firestore وتتبع الحركة.
   - يحتوي على **نظام حصانة العملاق المؤسس (Founding Super Admin Lockdown)** الذي يمنع تعديل أو سحب صلاحيات الحساب الرئيسي (`gemy.essam.ge@gmail.com`).

4. **`etaAuth.js` & `etaSubmit.js`**:
   - يتصل بسيرفرات ETA (`https://api.invoicing.eta.gov.eg`) باستخدام الـ Client ID والـ Client Secrets الخاصة بالشركة للحصول على الـ Access Token ثم إرسال حزمة الفواتير الموقعة.

---

<h3 align="right">ج. محرك التوقيع الإلكتروني (FawterX Signer - C#)</h3>

- **الملف:** `signer.cs`
- **وظيفته:** نظراً لأن المتصفحات (Chrome/Edge) لا تستطيع الوصول المباشر للـ USB Token الموصول بجهاز الكومبيوتر لأسباب أمنية، قمنا ببناء تطبيق خفيف بلغة **C#** يعمل كـ Local Bridge على الجهاز.
- **كيف يعمل؟**
  1. يتصل الـ Signer بالواجهة عبر WebSocket أو HTTP محلي (`localhost`).
  2. يستلم الـ JSON الخاص بالفاتورة.
  3. يستخدم مكتبة `System.Security.Cryptography` للوصول للشهادة الموجودة على الـ USB Token (مثل E-Tughra أو Egypt Trust).
  4. يقوم بتشفير وتوقيع الـ Canonical Hash للفاتورة وإرجاع الـ Document Structure جاهزاً للإرسال.

---

<h2 align="right">🔒 4. نظام الحماية وحصانة المؤسس (Founding Super Admin Immunity)</h2>

لحماية نظامك وتأمين مكانتك كـ **المؤسس والعملاق الأكبر للمنصة**:
- تم تثبيت الإيميل `gemy.essam.ge@gmail.com` في ملفات السيرفر (`warehouseStore.js`) والـ Frontend (`Warehouse.jsx`).
- النظام يكتشف هذا الإيميل تلقائياً ويمنحه لقب **`Master GM 👑`** بـ Super Admin Immunity دائم.
- لا يمكن لأي مستخدم آخر أو أدمن مجاور تعديل أو حظر أو تغيير صلاحيات هذا الحساب بأي حال من الأحوال.

---

<h2 align="right">🔄 5. دورة العمل النشر والتحديث الأوتوماتيكي (Deployment Rules)</h2>

بناءً على القاعدة القياسية المعتمدة للنظام:
1. عند التعديل في الكود يتم ترفيع رقم الإصدار في `package.json` و `App.jsx`.
2. إضافة تفاصيل الإصدار في `ReleaseNotesModal.jsx`.
3. إكمال الـ Build والتأكد من خلوه من الأخطاء عبر `npm run build`.
4. رفع الواجهة على **Firebase Hosting** عبر `npx firebase deploy --only hosting`.
5. دفع الكود ومزامنته مع **GitHub & Render** عبر `git push origin main`.

---

</div>
