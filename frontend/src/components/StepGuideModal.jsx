import React, { useState, useEffect } from 'react'

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
    <div className="modal-backdrop glassmorphism-heavy" style={{ zIndex: 20000 }}>
      <div 
        className="modal-card animate-zoom" 
        style={{ 
          width: '850px', 
          height: '760px', 
          maxWidth: '95vw', 
          maxHeight: '95vh', 
          display: 'flex', 
          flexDirection: 'column', 
          background: '#090b14', 
          border: '1px solid rgba(255, 255, 255, 0.08)', 
          boxShadow: '0 12px 48px rgba(0, 0, 0, 0.8)', 
          padding: '2rem', 
          borderRadius: '16px' 
        }}
      >
        <div className="modal-header" style={{ flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '1rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexDirection: isAr ? 'row-reverse' : 'row' }}>
          <h3 style={{ margin: 0, color: 'var(--accent, #00e0a1)', fontWeight: 800, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            📖 {isAr ? 'دليل الاستخدام خطوة بخطوة' : 'Step-by-Step Operations Guide'}
          </h3>
          <button 
            type="button" 
            className="btn-close-modal" 
            onClick={() => {
              onClose()
              localStorage.setItem('fawterx_tutorial_seen', 'true')
            }}
            style={{ cursor: 'pointer', fontSize: '1.4rem', background: 'transparent', border: 'none', color: 'var(--text-muted, #888)' }}
          >
            ✕
          </button>
        </div>
        
        <div className="modal-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '0 0.5rem' }}>
          <div style={{ opacity: isSlideFading ? 0 : 1, transform: isSlideFading ? 'scale(0.98)' : 'scale(1)', transition: 'all 0.18s ease-in-out', display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            <div style={{ 
              flexShrink: 0,
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              marginBottom: '1.25rem',
              flexDirection: isAr ? 'row-reverse' : 'row'
            }}>
              <h4 style={{ color: '#fff', fontWeight: 800, fontSize: '1.1rem', margin: 0 }}>
                {isAr ? currentStep.titleAr : currentStep.titleEn}
              </h4>
              <span style={{ 
                background: 'rgba(0, 224, 161, 0.15)', 
                color: '#00e0a1', 
                padding: '0.25rem 0.75rem', 
                borderRadius: '20px', 
                fontSize: '0.85rem', 
                fontWeight: 700 
              }}>
                {isAr ? `الخطوة ${tipSlide + 1} من 10` : `Step ${tipSlide + 1} of 10`}
              </span>
            </div>

            <div style={{ 
              flexShrink: 0,
              height: '300px',
              position: 'relative', 
              borderRadius: '12px', 
              overflow: 'hidden', 
              background: '#0b0d19', 
              border: '1px solid rgba(255,255,255,0.08)', 
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: '1.5rem'
            }}>
              <img 
                src={tipSlide === 0 ? '/Step 1.png' : `/step ${tipSlide + 1}.png`} 
                alt={`Step ${tipSlide + 1}`} 
                style={{ 
                  maxHeight: '100%', 
                  maxWidth: '100%', 
                  objectFit: 'contain', 
                  display: 'block'
                }} 
              />
            </div>

            <p style={{ 
              flex: 1,
              overflowY: 'auto',
              color: '#e0e0e0', 
              fontSize: '1.05rem', 
              lineHeight: '1.75', 
              textAlign: isAr ? 'right' : 'left',
              margin: '0 0 1.25rem 0',
              maxHeight: '130px',
              padding: '0.75rem 1rem',
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '10px',
              border: '1px solid rgba(255, 255, 255, 0.08)'
            }}>
              {isAr ? currentStep.descAr : currentStep.descEn}
            </p>
          </div>
        </div>

        <div className="modal-footer" style={{ 
          flexShrink: 0,
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          paddingTop: '1.25rem',
          flexDirection: isAr ? 'row-reverse' : 'row'
        }}>
          <button 
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={tipSlide === 0}
            onClick={() => handleSlideChange(Math.max(0, tipSlide - 1))}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem',
              opacity: tipSlide === 0 ? 0.4 : 1,
              cursor: tipSlide === 0 ? 'not-allowed' : 'pointer',
              color: '#fff',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              padding: '0.5rem 1rem',
              borderRadius: '8px'
            }}
          >
            {isAr ? 'السابق ➔' : '← Previous'}
          </button>

          <div style={{ display: 'flex', gap: '0.4rem' }}>
            {TUTORIAL_STEPS.map((_, idx) => (
              <span 
                key={idx}
                onClick={() => handleSlideChange(idx)}
                style={{ 
                  width: idx === tipSlide ? '24px' : '8px', 
                  height: '8px', 
                  borderRadius: '4px', 
                  background: idx === tipSlide ? '#00e0a1' : 'rgba(255, 255, 255, 0.2)',
                  transition: 'all 0.2s ease',
                  cursor: 'pointer'
                }}
              />
            ))}
          </div>

          {tipSlide < TUTORIAL_STEPS.length - 1 ? (
            <button 
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => handleSlideChange(Math.min(TUTORIAL_STEPS.length - 1, tipSlide + 1))}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem',
                cursor: 'pointer',
                background: '#00e0a1',
                color: '#000',
                fontWeight: 700,
                border: 'none',
                padding: '0.5rem 1.25rem',
                borderRadius: '8px'
              }}
            >
              {isAr ? '⬅ التالي' : 'Next →'}
            </button>
          ) : (
            <button 
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                onClose()
                localStorage.setItem('fawterx_tutorial_seen', 'true')
              }}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem',
                cursor: 'pointer',
                background: '#00e0a1',
                color: '#000',
                fontWeight: 800,
                border: 'none',
                padding: '0.5rem 1.5rem',
                borderRadius: '8px'
              }}
            >
              {isAr ? '🚀 البدء الآن' : '🚀 Get Started'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
