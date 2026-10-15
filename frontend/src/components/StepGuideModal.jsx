import React, { useState, useEffect } from 'react'
import { BookOpen, X, ChevronLeft, ChevronRight, Check, ArrowUpRight } from 'lucide-react'

const TUTORIAL_STEPS = [
  {
    titleAr: "الخطوة 1: الدخول إلى بورتال الضرائب الخاص بك",
    titleEn: "Step 1: Access Your Official ETA Portal Account",
    descAr: "قم بتسجيل الدخول إلى حساب شركتك الخاص على بوابة مصلحة الضرائب المصرية الرسمية الفعالة (ETA Portal) باستخدام بيانات اعتمادك المؤمنة.",
    descEn: "Log in to your corporate business dashboard on the official Egyptian Tax Authority (ETA) Portal using your secured credentials."
  },
  {
    titleAr: "الخطوة 2: الانتقال لخيار ERP والتهيئة",
    titleEn: "Step 2: Navigate to ERP System Configuration",
    descAr: "انزل إلى أسفل القائمة الجانبية في بوابة الضرائب واضغط على خيار تسجيل نظام تخطيط موارد المؤسسات (ERP Systems) للبدء في ربط فاوتر إكس.",
    descEn: "Scroll down the sidebar menu in the official portal and select registration of ERP Systems to integrate FawterX."
  },
  {
    titleAr: "الخطوة 3: إضافة نظام ربط جديد",
    titleEn: "Step 3: Register a New Integration System",
    descAr: "قم بالضغط على خيار تسجيل نظام جديد (Register ERP / New) لبدء إدخال بيانات نظام التكامل التلقائي الخارجي.",
    descEn: "Click on 'Register ERP' or 'Register New' to initialize the external automated integration credentials client."
  },
  {
    titleAr: "الخطوة 4: تسجيل وتسمية نظام FawterX",
    titleEn: "Step 4: Name and Register Your Connection",
    descAr: "قم بإدخال الاسم الذي تفضله لنظام التكامل الجديد (مثال: FawterX) ثم اضغط على زر التسجيل الفوري (Register) لتوليد مفاتيح التشفير.",
    descEn: "Enter any friendly identifier name you prefer for this linkage (e.g. FawterX), then click the Register button to securely generate your keys."
  },
  {
    titleAr: "الخطوة 5: حفظ المفاتيح المستخرجة",
    titleEn: "Step 5: Save the Generated API Credentials",
    descAr: "قم بنسخ وحفظ البيانات السرية التي ظهرت لك على البوابة (Client ID & Client Secret 1 & 2) بعناية فائقة لاستخدامها وتفعيلها في فاوتر إكس.",
    descEn: "Safely copy and save the generated sensitive credentials (Client ID, Client Secret 1 & 2) immediately for the next step."
  },
  {
    titleAr: "الخطوة 6: فتح إعدادات الشركة في فاوتر إكس",
    titleEn: "Step 6: Open Company Setup in FawterX",
    descAr: "قم بالضغط على خيار 'إعدادات الشركة' المتواجد بأعلى منصة فاوتر إكس لفتح نافذة إدخال بيانات الارتباط والربط الإلكتروني.",
    descEn: "Click on 'Company Setup' at the top of the FawterX platform to open the integration credentials window."
  },
  {
    titleAr: "الخطوة 7: لصق البيانات وإجراء اختبار اتصال مباشر",
    titleEn: "Step 7: Paste Credentials and Test Connection",
    descAr: "قم بلصق بيانات الربط المستخرجة من بورتال الضرائب (Client ID & Client Secrets) في الخانات المخصصة لها، ثم اضغط على زر 'اختبار الاتصال المباشر' للتحقق الفوري من صحتها.",
    descEn: "Paste your generated Client ID and Client Secrets into their respective fields, then click the 'Test Direct Connection' button to verify real-time status."
  },
  {
    titleAr: "الخطوة 8: تأكيد الاتصال وحفظ المفاتيح بأمان",
    titleEn: "Step 8: Save & Update API Credentials",
    descAr: "بمجرد نجاح الاتصال وتأكيد ارتباط النظام ببوابة الضرائب بنجاح، قم بالضغط على زر 'حفظ وتحديث المفاتيح' لتثبيت بيانات شركتك بشكل آمن والبدء في الفوترة.",
    descEn: "Once the success indicator confirms a valid live connection to the ETA portal, click the 'Save & Update Credentials' button to finalize your setup securely."
  },
  {
    titleAr: "الخطوة 9: تحميل وتشغيل أداة التوقيع FawterX Signer",
    titleEn: "Step 9: Download and Run FawterX Signer Bridge",
    descAr: "قم بتحميل أداة العبور والتوقيع الإلكتروني (Signer Bridge) لتتيح للموقع الاتصال بدونجل التوقيع مباشرة، وتأكد من تركيب الـ USB Token بجهازك ليتم التوقيع والإرسال التلقائي.",
    descEn: "Download our local digital signing bridge utility to enable the platform to communicate directly with your USB Dongle. Ensure your USB Token is plugged into your PC."
  },
  {
    titleAr: "الخطوة 10: تهانينا! أنت الآن جاهز تماماً للبدء",
    titleEn: "Step 10: Congratulations! You Are Ready",
    descAr: "مبروك! لقد أتممت جميع خطوات إعداد وتهيئة الربط مع مصلحة الضرائب المصرية بنجاح كامل. أنت الآن جاهز لرفع فواتيرك وتوقيعها وإرسالها بلمح البصر!",
    descEn: "Congratulations! You have successfully completed all registration and integration steps. You are now fully ready to upload your Excel files, sign them, and submit them in seconds."
  }
]

export default function StepGuideModal({ isOpen, onClose, lang = 'ar' }) {
  const [tipSlide, setTipSlide] = useState(0)
  const [isSlideFading, setIsSlideFading] = useState(false)
  const isAr = lang === 'ar'

  useEffect(() => {
    if (isOpen) {
      setTipSlide(0)
    }
  }, [isOpen])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowRight') {
        if (isAr) handleSlideChange(Math.max(0, tipSlide - 1))
        else handleSlideChange(Math.min(TUTORIAL_STEPS.length - 1, tipSlide + 1))
      } else if (e.key === 'ArrowLeft') {
        if (isAr) handleSlideChange(Math.min(TUTORIAL_STEPS.length - 1, tipSlide + 1))
        else handleSlideChange(Math.max(0, tipSlide - 1))
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, tipSlide, isAr])

  if (!isOpen) return null

  const handleSlideChange = (newSlideIndex) => {
    if (newSlideIndex === tipSlide || isSlideFading) return
    setIsSlideFading(true)
    setTimeout(() => {
      setTipSlide(newSlideIndex)
      setIsSlideFading(false)
    }, 180)
  }
  const currentStep = TUTORIAL_STEPS[tipSlide]

  return (
    <div className="modal-backdrop fx-guide-backdrop" style={{ zIndex: 20000 }}>
      <section className={`fx-guide animate-zoom ${!isAr ? 'ltr-layout' : ''}`} role="dialog" aria-modal="true" aria-labelledby="guide-title">
        <header className="fx-guide-header">
          <div><span className="fx-guide-brand-icon"><BookOpen size={23} strokeWidth={1.6} /></span><div><span className="fx-eyebrow">GETTING STARTED / FAWTERX</span><h2 id="guide-title">{isAr ? 'كل خطوة، في مكانها.' : 'Every step, in its place.'}</h2></div></div>
          <button type="button" className="fx-icon-button" aria-label={isAr ? 'إغلاق الدليل' : 'Close guide'} onClick={() => { onClose(); localStorage.setItem('fawterx_tutorial_seen', 'true') }}><X size={21} /></button>
        </header>
        <div className="fx-guide-layout">
          <nav className="fx-guide-rail" aria-label={isAr ? 'خطوات الإعداد' : 'Setup steps'}>
            <span className="fx-eyebrow">{isAr ? 'خريطة البداية' : 'YOUR SETUP ROADMAP'}</span>
            {TUTORIAL_STEPS.map((item, idx) => <button type="button" key={idx} aria-current={idx === tipSlide ? 'step' : undefined} className={`fx-guide-step ${idx === tipSlide ? 'active' : ''} ${idx < tipSlide ? 'done' : ''}`} onClick={() => handleSlideChange(idx)}><span>{idx < tipSlide ? <Check size={13} /> : String(idx + 1).padStart(2, '0')}</span><b>{(isAr ? item.titleAr : item.titleEn).replace(/^(الخطوة|Step) \d+:\s*/, '')}</b></button>)}
          </nav>
          <main className={`fx-guide-main ${isSlideFading ? 'is-fading' : ''}`}>
            <div className="fx-guide-stage"><span>{isAr ? 'الخطوة الحالية' : 'CURRENT STEP'}</span><strong>{String(tipSlide + 1).padStart(2, '0')} <small>/ {TUTORIAL_STEPS.length}</small></strong></div>
            <div className="fx-guide-track"><span style={{ width: `${((tipSlide + 1) / TUTORIAL_STEPS.length) * 100}%` }} /></div>
            <h3>{isAr ? currentStep.titleAr : currentStep.titleEn}</h3>
            <figure className="fx-guide-figure"><div className="fx-guide-window-bar"><i /><i /><i /><span>{isAr ? 'مرجع بصري للخطوة' : 'VISUAL STEP REFERENCE'}</span></div><img src={tipSlide === 0 ? '/Step 1.png' : `/step ${tipSlide + 1}.png`} alt={isAr ? currentStep.titleAr : currentStep.titleEn} /></figure>
            <div className="fx-guide-instruction"><span className="fx-guide-instruction-icon"><BookOpen size={18} /></span><div><b>{isAr ? 'المطلوب في الخطوة دي' : 'WHAT TO DO'}</b><p>{isAr ? currentStep.descAr : currentStep.descEn}</p></div></div>
          </main>
        </div>
        <footer className="fx-guide-footer">
          <button type="button" className="btn btn-ghost" disabled={tipSlide === 0} onClick={() => handleSlideChange(Math.max(0, tipSlide - 1))}>{isAr ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}{isAr ? 'السابق' : 'Previous'}</button>
          <span>{isAr ? 'تقدر تتنقل بين الخطوات من القائمة' : 'Choose any step from the roadmap'}</span>
          {tipSlide < TUTORIAL_STEPS.length - 1 ? <button type="button" className="btn btn-accent" onClick={() => handleSlideChange(Math.min(TUTORIAL_STEPS.length - 1, tipSlide + 1))}>{isAr ? 'الخطوة التالية' : 'Next step'}{isAr ? <ChevronLeft size={17} /> : <ChevronRight size={17} />}</button> : <button type="button" className="btn btn-accent" onClick={() => { onClose(); localStorage.setItem('fawterx_tutorial_seen', 'true') }}>{isAr ? 'ابدأ شغلك' : 'Get started'}<ArrowUpRight size={17} /></button>}
        </footer>
      </section>
    </div>
  )
}
