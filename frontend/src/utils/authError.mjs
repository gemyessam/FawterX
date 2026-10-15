export function googleLoginError(error, lang = 'ar') {
  const ar = lang === 'ar'
  const code = /^auth\/[a-z-]+$/.test(error?.code || '') ? error.code : 'auth/unknown'
  const messages = {
    'auth/unauthorized-domain': ar ? 'عنوان الموقع الحالي غير مصرح به في Firebase. جرّب localhost:3000. لو استمر الخطأ، أضف localhost إلى Authentication → Settings → Authorized domains.' : 'This origin is not authorized in Firebase. Try localhost:3000. If it persists, add localhost in Authentication → Settings → Authorized domains.',
    'auth/popup-blocked': ar ? 'المتصفح منع نافذة Google. اسمح بالنوافذ المنبثقة للموقع ثم اضغط تسجيل الدخول مرة أخرى.' : 'The browser blocked the Google popup. Allow popups for this site and retry.',
    'auth/popup-closed-by-user': ar ? 'نافذة Google اتقفلت قبل اكتمال الدخول. افتحها مرة أخرى وأكمل اختيار الحساب.' : 'The Google popup closed before sign-in completed. Retry and finish selecting your account.',
    'auth/cancelled-popup-request': ar ? 'في محاولة دخول أخرى مفتوحة. أكملها أو أغلقها ثم جرّب مرة واحدة.' : 'Another sign-in popup is active. Complete or close it, then retry once.',
    'auth/network-request-failed': ar ? 'تعذر الاتصال بخدمة تسجيل الدخول. تحقق من الاتصال ومنع التتبع أو إضافات المتصفح.' : 'Unable to reach authentication services. Check connectivity and browser privacy extensions.',
    'auth/operation-not-allowed': ar ? 'تسجيل Google غير مفعّل في إعدادات Firebase لهذا المشروع.' : 'Google sign-in is disabled in this Firebase project.',
  }
  return `${messages[code] || (ar ? 'تعذر تسجيل الدخول. ابعت كود الخطأ الظاهر لتحديد السبب.' : 'Unable to sign in. Share this error code to diagnose the cause.')} (${code})`
}
