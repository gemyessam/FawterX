# FawterX — تسليم التصميم المحلي إلى Antigravity

**التاريخ:** 2026-10-05 (Africa/Cairo)  
**المسار:** `C:/Users/GeMy/.codex/worktrees/9f19/FawterX`  
**الحالة:** تغييرات محلية غير committed؛ لا نشر ولا push ولا زيادة إصدار. هذا ملف تسليم عمل، وليس تقرير إصدار منشور.

## 1. طلب المستخدم وحدود المهمة

المستخدم طلب إعادة تصميم شاملة، لا مجرد تغيير ألوان: واجهة احترافية، أنيميشن، صفحة مخزون، وضع فاتح واضح ودارك أسود وأبيض، ثم تجربة تسجيل دخول Google حقيقية مع بقاء الواجهة لوكال. سمح صراحة في المحادثة بأن يخطط Codex وينفذ لهذه المهمة. هذا لا يلغي اتفاق `AGENTS.md` لبقية المهام؛ راجع الاتفاق قبل أي عمل جديد.

- لا تنشر هذا التصميم ولا تعتبر نجاح build تصريحًا للنشر.
- لا تتراجع عن تعديلات غير مرتبطة بالمهمة. الشجرة الحالية dirty.
- ممنوع أدوات المتصفح الآلية، headless Chromium، screenshots أو تسجيل فيديو. المستخدم يراجع الشكل في متصفحه. التحقق هنا CLI فقط.
- لا تختبر إرسال ETA فعليًا، الكتابة في Firestore الإنتاجية أو توقيع USB كاختبار جانبي.
- وضع الحساب الحقيقي يقرأ بيانات من API الإنتاج الحالي؛ كلمة «لوكال» تصف الواجهة فقط، وليست نسخة محلية من قاعدة البيانات.
- لا يوجد تشغيل backend محلي ضمن الجلسة الحالية.

## 2. اتجاه التصميم وما تم تنفيذه

### الهيكل العام

استبدال الواجهة القديمة بتقسيم workspace: شريط جانبي للملاحة، topbar سياقي، عناوين صفحات واضحة ومساحات محتوى منتظمة. تم الحفاظ على handlers ومسارات التطبيق القائمة بدل إنشاء وظائف أعمال بديلة.

| الملف | دوره والتغيير |
| --- | --- |
| `frontend/src/components/WorkspaceNavigation.jsx` | Sidebar وtopbar، صلاحيات الروابط، اللغة، أدوات الحساب والخروج، قائمة موبايل وزر الثيم. |
| `frontend/src/components/LoginExperience.jsx` | شاشة دخول جديدة مع مشهد مستندات متحرك، زر Google الحالي، وضع التطوير عند السماح به ورسالة خطأ مستمرة. |
| `frontend/src/components/DashboardOverview.jsx` | لوحة رئيسية جديدة تعرض الإحصاءات والاستهلاك الموجودين، بداية العمل والمسودات والأدوات. |
| `frontend/src/components/DesignSystem.jsx` | `Brand` و`PageHeading` و`EmptyIllustration` و`MotionRegion`. |
| `frontend/src/components/WorkflowProgress.jsx` | تقدم رحلة الفاتورة ومراحلها مع `aria-current`. |
| `frontend/src/components/ThemeToggle.jsx` | تبديل الفاتح والداكن مع أيقونات وlabels. |
| `frontend/src/App.jsx` | دمج الملاحة والدخول والثيم والبانرات، تصدير Layout للاختبار، وتعطيل dev bypass في معاينة الحساب الحقيقي. |

### الصفحات والأجزاء الداخلية

- `Home.jsx`: لوحة البداية، اختيار مسار الملف، رحلة الفاتورة وإطار المحتوى.
- `Drafts.jsx` و`DraftDetails.jsx`: عناوين وحاويات المسودات وحالة القائمة الفارغة.
- `Warehouse.jsx`: عنوان وسياق المشروع، معلومات المخزون، تبويبات وأيقونات؛ نقل كثير من الألوان الثابتة إلى متغيرات الثيم.
- `AdminPanel.jsx`: عنوان وتصميم إطار الإدارة وتنسيق الأسطح.
- `UploadStep.jsx`: مساحة رفع الملف وأيقونة الملف وعنوان المرحلة.
- `MappingStep.jsx`: عنوان جديد، أيقونة أعمدة، عدد أعمدة الملف، شبكة حقول تستجيب للموبايل وحالة `is-connected` للحقول المربوطة. قواعد الربط والتحقق الحالية محفوظة.
- `PreviewStep.jsx`: إطار مراجعة جديد وعنوان واضح، تنسيق الجداول والإجماليات والتنبيه؛ حسابات الضرائب والإرسال لم تُعد كتابتها.
- `BatchWorkflow.jsx`: عنوان ومراجعة دفعات، sidebar للفواتير يعاد ترتيبه على الموبايل؛ handlers التعديل والإرسال الحالية محفوظة.
- `DispatchesTrackerView.jsx`: عنوان رحلة الصرف للتسليم، إطار تتبع وتنسيق ثيم.
- `ManualStockModal.jsx`: سطح نافذة تابع للثيم بدل الخلفية القديمة الثابتة، header وترتيب موبايل، تعريف dialog.
- `Security2FAModal.jsx`: سطح وثيم وأزرار ومدخلات متناسقة وتعريف dialog. **لم نفعّل أو نغيّر منطق 2FA في الخلفية.** التطبيق كان يعطله قبل هذا التسليم وما زال كذلك.
- `ReleaseNotesModal.jsx`: ثيم سطح النافذة والعنوان والتبويبات، dialog؛ لم نكتب إصدارًا جديدًا أو نزعم نشره.
- `ErrorBoundary.jsx`: حالة خطأ تتبع الثيم.

### دليل الاستخدام

`StepGuideModal.jsx` أعيد تصميمه كنافذة بها قائمة كل الخطوات العشر، رقم الخطوة الحالية، شريط تقدم، صورة مرجعية داخل إطار وتعليمات وأزرار سابق/تالي/البدء. قائمة الموبايل أفقية. البيانات الثنائية اللغة ونفس الصور محفوظة:

- أول صورة `/Step 1.png` بحرف S كبير.
- باقي الصور `/step N.png` بحرف s صغير.
- لا تغيّر حالة أحرف الملفات دون مراجعة؛ النشر على نظام حساس لحالة الأحرف يمكن أن يكشف مشكلة لا تظهر على Windows.

## 3. الألوان والأنيميشن: كيف يعمل النظام

الاستيراد في `frontend/src/main.jsx` بالترتيب:

1. `index.css` — التنسيق الأصلي.
2. `workspace-design.css` — تصميم workspace والمكونات الرئيسية ودليل الاستخدام.
3. `light-theme.css` — الوضع الفاتح وتعديلات الأسود والأبيض للداكن.
4. `interface-surfaces.css` — توحيد الجداول والنماذج والنوافذ والمراجعة والموبايل.

هذا الترتيب مقصود. إضافة CSS قبل الملفات الأخيرة قد تجعل التغيير غير ظاهر بسبب cascade.

- `html[data-theme="light"|"dark"]` يتحكم في الثيم.
- `frontend/src/utils/theme.mjs`: قراءة وتخزين `fawterx_theme`، الفاتح هو الافتراضي، مع حماية من فشل localStorage.
- متغيرات الأساس: `--bg`, `--bg-card`, `--bg-surface`, `--accent`, `--text`, `--text-muted`, `--border`.
- متغيرات توافق في `interface-surfaces.css`: `--card-bg`, `--bg-lighter`, `--surface-tint`, `--surface-shadow`.
- نقلنا نصوصًا بيضاء وخلفيات كحلية وألوان accent خضراء ثابتة من inline styles إلى متغيرات الثيم. عدة alpha colors تستخدم `color-mix(in srgb, ...)` الآن.
- لم يتم تحويل كل inline style إلى classes؛ هذه فرصة لتنظيف لاحق، بعد اختبار كل قسم. بعض درجات الحالات الدلالية الحمراء/الصفراء/الزرقاء موجودة عمدًا أو تحتاج مراجعة بصرية.
- GSAP كان موجودًا، وتم استخدامه في `MotionRegion` ومشهد `InvoicePipeline`.
- `MotionRegion` يحرك العناصر ذات `data-enter` داخل منطقته فقط، ويستثني nested motion regions لتجنب تكرار الحركة.
- `gsap.matchMedia` و`media.revert()` للتعامل مع تقليل الحركة والتنظيف.
- `interface-surfaces.css` فيه override عام عند `prefers-reduced-motion: reduce`.
- إضافة اعتماد `lucide-react` وتحديث package-lock؛ لا تحتاج مكتبة حركة جديدة.

لإضافة جزء جديد: استخدم `PageHeading`، متغيرات الثيم، classes مخصصة، `data-enter` عند الحاجة، breakpoint للموبايل، وحالة تحميل/فارغ/خطأ مفهومة. لا تبدأ بعناصر مخفية تعتمد على JavaScript لكي تظهر؛ تعطل الحركة يجب ألا ينتج صفحة فارغة.

## 4. أوضاع تشغيل لوكال — مهم جدًا

Vite يعمل على port 3000. flags هي إعدادات process وقت التشغيل وليست محفوظة حاليًا في ملف `.env` للمشروع. تشغيل `npm run dev` العادي لاحقًا لن يرثها تلقائيًا.

### أ. معاينة التصميم ببيانات تجريبية

```powershell
Set-Location 'C:/Users/GeMy/.codex/worktrees/9f19/FawterX'
$env:VITE_ACCOUNT_PREVIEW = '0'
$env:VITE_DESIGN_PREVIEW = '1'
npm --prefix frontend run dev -- --host 127.0.0.1 --port 3000 --strictPort
```

`frontend/design-preview.mjs` يقدم fixtures صريحة للعرض: مشروع `design-demo`، أربع عينات مخزون رقمية، وبعض قوائم فارغة. يوفر banner بأن الأرصدة تجريبية. كل mutations ترجع403 وكل API غير مدعوم يرجع404؛ لا تسقط الطلبات إلى backend الحقيقي. لا تستخدم fixtures لإثبات صحة الحسابات أو الصلاحيات الحقيقية.

### ب. معاينة حساب Google حقيقي — الوضع الحالي

```powershell
Set-Location 'C:/Users/GeMy/.codex/worktrees/9f19/FawterX'
$env:VITE_DESIGN_PREVIEW = '0'
$env:VITE_ACCOUNT_PREVIEW = '1'
npm --prefix frontend run dev -- --host 127.0.0.1 --port 3000 --strictPort
```

افتح **`http://localhost:3000/`**. الدخول بواسطة Firebase Google الموجود أصلًا. لا ترسل حسابًا أو كلمة مرور إلى CLI أو brief.

- `vite.config.js` يجعل `/api` proxy إلى **`https://fawterx-api.onrender.com`** في هذا الوضع.
- `frontend/account-preview.mjs` يسمح فقط بـGET في قائمة routes محددة: usage/settings/customers/operations/drafts، قراءات admin، access/projects وقراءات stock/dispatches/invoices/audit-logs/restore-points/aliases/movements.
- كل الطرق الأخرى وكل endpoints غير المسموحة ترجع403 قبل proxy. حتى GET إلى `/eta/test-auth` أو `/eta/submit` محظور.
- التحقق الحقيقي من صلاحيات بيانات الحساب يتم في الـAPI الحالي؛ plugin المحلي لا يمنح أدوارًا.
- إخفاء زر dev login وتجاهل `fawterx_dev_bypass` و`useQuickLogin` في هذا الوضع.
- `syncUserData` لا ينفذ POST في وضع الحساب الحقيقي؛ يمنع تعديل بيانات المستخدم أثناء المعاينة. حساب جديد غير مسجل في backend قد يحتاج تهيئة حقيقية خارج وضع القراءة فقط، ولا تتحايل على الحظر.
- تسجيل Google يزيل flags الدخول التجريبي القديمة قبل المحاولة.
- banner يوضح أن البيانات حقيقية وقراءة فقط؛ الأزرار الحالية التي تحاول mutations قد تظل ظاهرة لكن السيرفر المحلي يرفضها. يمكن تحسين disabled states لاحقًا دون إزالة حظر السيرفر.
- لا تعدّل plugin للسماح بالإرسال الحقيقي لمجرد أن زرًا لا يعمل. ذلك يحتاج نطاق عمل وتصريحًا منفصلين.
- أولوية `VITE_ACCOUNT_PREVIEW=1` أعلى من `VITE_DESIGN_PREVIEW=1` في config وفي banner.

### ج. الواجهة مع backend محلي عادي

```powershell
$env:VITE_DESIGN_PREVIEW = '0'
$env:VITE_ACCOUNT_PREVIEW = '0'
npm --prefix frontend run dev -- --host 127.0.0.1 --port 3000 --strictPort
```

يرجع proxy إلى `http://localhost:5000`. لا تشغّل backend دون فهم إعداداته وآثار الكتابة. وضع التشغيل العادي ليس محميًا بحظر mutations الخاص بمعاينة الحساب.

إذا port3000 مشغول، لا تقتل كل node processes. افحص command line للعملية التي تملك المنفذ وتأكد أنها Vite لهذا المشروع فقط قبل إيقافها. لا تعتمد على PID قديم.

## 5. مشكلة تسجيل الدخول: الحالة الفعلية

المستخدم أبلغ عن فشل Google. الرسالة القديمة كانت عامة ولا تكشف السبب. **لم نثبت السبب، ولم نؤكد نجاح الدخول الفعلي.**

ما تم:

- `frontend/src/utils/authError.mjs` يميز unauthorized-domain / popup-blocked / popup-closed-by-user / cancelled-popup-request / network-request-failed / operation-not-allowed.
- يعرض code موثوق الشكل مثل `auth/unauthorized-domain` دون عرض raw error payload قد يحتوي معلومات حساسة.
- `App.jsx` يخزن `loginError` ويعرض toast أطول.
- `LoginExperience.jsx` يعرض رسالة ثابتة `role=alert` تحت زر Google، مع رابط localhost عند وجود المستخدم على127.0.0.1.
- المستخدم انتقل إلىlocalhost، لكن لا توجد في المحادثة نتيجة محاولة لاحقة بكود الخطأ الجديد.

خطوات Antigravity التالية عند استئناف العطل:

1. اطلب كود `auth/...` الظاهر بعد المحاولة الجديدة، بدل تخمين المشكلة.
2. إن كان unauthorized-domain: راجع Firebase Authentication → Settings → Authorized domains. تحقق منlocalhost و127.0.0.1 كل على حدة. لا تغيّر إعدادات المشروع دون تصريح.
3. إن كان popup-blocked: يفتح المستخدم في متصفحه الخارجي ويسمح بالـpopups. لا تبدأ browser automation.
4. إن كان network-request-failed: افحص اتصال المستخدم والإضافات/الخصوصية؛ لا تبدّل credentials عشوائيًا.
5. `authDomain` الحالي هو `fawterx.firebaseapp.com`. لا تغيّره ولا تستبدل مشروع Firebase بمحاكاة وتسمّيها دخولًا حقيقيًا.

مرجع رسمي: https://firebase.google.com/docs/auth/web/google-signin  
Authorized domains وتشخيص localhost: https://firebase.google.com/docs/auth/faq-and-troubleshooting

## 6. التحقق وما لا يثبته

```powershell
node --test frontend/tests/*.test.mjs
npm --prefix frontend run build
git diff --check
```

- الاختبارات الحالية: **22/22** بعد إضافة اختبارات أخطاء الدخول، محليًا بتاريخ التسليم.
- build ناجح. تحذير حجم JavaScript chunk أكبر من500kB وتحذير Vite CJS موجودان؛ لم نحل تقسيم الحزمة ضمن هذه المهمة.
- layout-render يستخدم esbuild وReact server rendering، ليس متصفحًا؛ يختبر layout مع الدليل مفتوحًا ومغلقًا.
- theme tests تختبر default/persistence/storage errors/toggle.
- preview tests تختبر fixtures والحظر، وaccount-preview tests تختبر قراءات مسموحة وحظر mutations وETA actions.
- auth-error tests تختبر اختلاف رسائل المشكلة وعدم تسريب raw payload.
- باقي اختبارات المخزون الموجودة نجحت أيضًا.
- لا توجد مراجعة بصرية آلية، ولا إثبات end-to-end للدخول الحقيقي أو استجابة production API بحساب المستخدم.
- اختبارات backend لم تُشغّل لهذه التغييرات؛ لم نغيّر backend.

## 7. التشغيل الحالي والسجلات

تم تشغيل Vite مخفيًا على127.0.0.1:3000 في وضع الحساب الحقيقي. حالة العملية قد تتغير بعد إغلاق الجلسة؛ تحقّق من المنفذ بدل الثقة في هذا الملف.

سجلات التشغيل خارج التطبيق:

```text
C:/Users/GeMy/.codex/reviews/FawterX/local-redesign-20261005/account-preview-vite.log
C:/Users/GeMy/.codex/reviews/FawterX/local-redesign-20261005/account-preview-vite-error.log
```

لا تضف tokens أو بيانات فواتير أو secrets إلى هذا الملف أو logs أو briefs.

## 8. طريقة متابعة العمل بدون فقد التغييرات

1. اقرأ هذا الملف ثم `AGENTS.md` و`docs/design/LOCAL_REDESIGN.md`.
2. راجع `git status --short` و`git diff --stat` والـdiff الحالي بما يشمل الملفات untracked. لا تعتمد على release logs تاريخية لإثبات الحالة الحالية.
3. أصلح فشل الدخول بناءً على كود الخطأ الحقيقي أولًا.
4. للتصميم: عدّل المكون المحدد + ملف CSS المناسب، راعِ الفاتح والداكن وRTL/LTR والموبايل؛ لا تكتفِ بتبديل اللون العام.
5. لأي تغيير سلوك، اكتب regression test مفيد؛ تغييرات CSS البسيطة لا تحتاج اختبارات تعكس implementation فقط.
6. أعد CLI checks ذات الصلة. المراجعة البصرية عند المستخدم فقط.
7. لا commit/push/deploy تلقائيًا. إن طُلب إصدار لاحقًا، اتبع اتفاق الأدوار والمراجعة، وضع سجل الإصدار في `release_logs/RELEASE_LOG_v<VERSION>.md` فقط.

**استئناف سريع:** الواجهة الجديدة موجودة في working tree، تعمل محليًا، الوضع الحالي قراءة بيانات حساب حقيقي، التسجيل الفعلي لم يُثبت نجاحه، وأحدث إضافة هي رسالة خطأ Google تفصيلية. لا تخلط fixture preview مع real-account preview.

## تحديث لاحق في نفس اليوم: ألوان أهدأ ومعرض الشاشات

- `frontend/src/calm-theme.css` آخر ملف CSS بعد interface-surfaces: فاتح off-white مع accent أزرق رمادي خافت، وداكن فحمي بنصوص رمادية فاتحة. Overrides متعمدة لتقليل ألوان violet الثابتة السابقة.
- `http://localhost:3000/design-showcase`: معرض DEV فقط، يعمل دون تسجيل Google ولا يبدأ AccountApp أو يجلب جلسة المستخدم. `DesignShowcase.jsx` يستخدم context تجريبيًا وMemoryRouter و26 شاشة/حالة، بما فيها تبويبات المخزون الستة الإضافية والنوافذ والتحميل/الخطأ/الفارغ. إعدادات الشركة هنا تمثيل بصري، وليس نموذجًا متصلًا ببيانات المستخدم.
- المعرض يعرض المكونات الحالية ببيانات `frontend/showcase-data.mjs` ويعطّل controls داخل fieldset لمنع التنفيذ؛ الدليل وسجل الإصدارات يسمحان بتنقل آمن. غلق نوافذ التوريد والصرف والتحقق بزر غلق معاينة مستقل.
- خدمات api.js وwarehouseApi.js تضيف header `X-Fawterx-Showcase: 1` فقط عند DEV وpathname مطابق للمعرض، وتعود قبل token/ETA secrets injection.
- Vite يقدم tagged fixture middleware قبل account-preview الحقيقي، ولا يمرر الطلبات الموسومة للـAPI الحقيقي. كل mutations تظل403. البيانات غير الموسومة في وضع الحساب الحقيقي تظل تمر على readonly policy الحالية.
- design-preview fixtures أصبحت تشمل مسودة وuser تجريبي وإذن صرف جزئي. لا تعتبر هذه fixtures دليلًا على صحة حسابات الأعمال.
- props DEV اختيارية `designDocuments` / `designPreview` / `designTab` لتهيئة BatchWorkflow وPreviewStep وAdminPanel وWarehouse في العرض فقط؛ الاستخدام العادي لم يتغير.
- منع تشغيل/توقيع Signer صراحة من مسار المعرض. Toaster أصبح يتبع متغيرات الثيم.
- tests: `showcase-isolation.test.mjs` يثبت عدم انتقال tagged API requests للإنتاج؛ `showcase-render.test.mjs` يفحص server-render لكل26 شاشة (بدون متصفح أو network). إجمالي اختبارات frontend24 ناجحة. SSR لا يثبت الشكل النهائي أو render بعد effects؛ المراجعة البصرية للمستخدم.
- المسار لا يعمل كمعرض في production بسبب DEV gate. لم يحدث deploy أو commit.
