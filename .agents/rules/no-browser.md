# Strict Prohibition on Browser Tools (No Browser Rule)
# حظر استخدام أدوات المتصفح الآلي نهائياً

<div dir="rtl" align="right">

## 1. التوجيه الإلزامي (Mandatory Directive)
- يُحظر **حظرًا قاطعًا ومطلقًا** على الوكيل (Antigravity أو أي وكيل آخر) استخدام أداة `browser_subagent` أو أي أدوات تحكم بالمتصفح الآلي (Headless Chromium / Automated Browser Testing).
- يُمنع منعًا باتًا تشغيل جلسات المتصفح، أو تسجيل الفيديوهات، أو التقاط لقطات الشاشة عبر أدوات المتصفح الآلية.
- التحقق من أي تعديلات برمجية يتم **فقط وحصريًا** عبر سطر الأوامر (CLI / Build / Test Scripts):
  - الواجهة الأمامية: `npm --prefix frontend run build`
  - الواجهة الخلفية: `npm --prefix backend test -- --runInBand`
- الفحص البصري وتجربة الواجهة (Visual UI Testing) متروكة بالكامل وحصريًا للمستخدم في متصفحه الشخصي عبر `http://localhost:3000`.

## 2. السبب والدافع (Rationale)
- فُرضت هذه القاعدة بناءً على أمر مباشر وصريح من المستخدم في 2026-09-13 لمنع استهلاك سرعة الإنترنت (Bandwidth / Network Choking) ومنع ثقل وبطء الجهاز الناجم عن تسجيل وتحميل الوسائط وفيديوهات المتصفح.

</div>

---

## English Summary

- **ZERO automated browser usage (`browser_subagent`).**
- Do NOT launch automated browser sessions, headless navigation, screenshot capture via browser, or video recording.
- All testing and verification must be conducted strictly via local terminal/CLI commands.
- Visual inspection is left exclusively to the user in their own personal browser.
- Established per explicit user directive on 2026-09-13 to eliminate bandwidth consumption and system slowdown.
