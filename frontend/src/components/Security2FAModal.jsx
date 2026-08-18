import React, { useState, useEffect } from 'react'
import { verifyAuthSecurityCode, resendAuthSecurityCode } from '../services/api'

export default function Security2FAModal({
  isOpen,
  userEmail,
  emailMasked,
  onVerifySuccess,
  onLogout,
  lang = 'ar'
}) {
  const isAr = lang === 'ar'
  const [code, setCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(60)
  const [resendSuccessMsg, setResendSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    let timer = null
    if (isOpen && resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0))
      }, 1000)
    }
    return () => {
      if (timer) clearInterval(timer)
    }
  }, [isOpen, resendCooldown])

  if (!isOpen) return null

  const displayEmail = emailMasked || (userEmail ? userEmail.replace(/(.{2})(.*)(?=@)/, '$1****') : '')

  const handleVerify = async (e) => {
    e.preventDefault()
    if (!code || code.trim().length !== 6) {
      setErrorMsg(isAr ? 'برجاء إدخال رمز التحقق المكون من 6 أرقام كاملة.' : 'Please enter the full 6-digit security code.')
      return
    }

    setVerifying(true)
    setErrorMsg('')
    setResendSuccessMsg('')

    try {
      const data = await verifyAuthSecurityCode(code.trim())
      if (data.success) {
        onVerifySuccess()
      } else {
        setErrorMsg(data.message || (isAr ? 'رمز التحقق غير صحيح' : 'Invalid security code'))
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message
      setErrorMsg(msg || (isAr ? 'حدث خطأ أثناء التحقق من الرمز' : 'Error verifying security code'))
    } finally {
      setVerifying(false)
    }
  }

  const handleResend = async () => {
    if (resending || resendCooldown > 0) return

    setResending(true)
    setErrorMsg('')
    setResendSuccessMsg('')

    try {
      const res = await resendAuthSecurityCode()
      if (res.success) {
        setResendSuccessMsg(isAr ? 'تم إرسال رمز أمان جديد إلى بريدك الإلكتروني بنجاح! ✉️' : 'New security code sent to your email! ✉️')
        setResendCooldown(60)
      } else {
        setErrorMsg(res.message || (isAr ? 'تعذر إرسال الرمز، يرجى المحاولة لاحقاً.' : 'Failed to resend code.'))
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message
      setErrorMsg(msg || (isAr ? 'حدث خطأ أثناء إرسال الرمز' : 'Error resending code'))
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="modal-backdrop fade-in" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(5, 7, 15, 0.92)',
      backdropFilter: 'blur(16px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      padding: '1rem'
    }}>
      <div style={{
        background: 'linear-gradient(145deg, rgba(20, 24, 40, 0.98), rgba(10, 12, 22, 0.99))',
        border: '1px solid rgba(255, 215, 0, 0.35)',
        borderRadius: '24px',
        maxWidth: '480px',
        width: '100%',
        padding: '2.4rem 2rem',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.9), 0 0 30px rgba(255, 215, 0, 0.12)',
        textAlign: 'center',
        direction: isAr ? 'rtl' : 'ltr'
      }}>
        {/* Security Shield Icon */}
        <div style={{
          width: '74px',
          height: '74px',
          margin: '0 auto 1.2rem',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255, 215, 0, 0.25), rgba(0, 224, 161, 0.08))',
          border: '2px solid #FFD700',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '2.4rem',
          boxShadow: '0 0 25px rgba(255, 215, 0, 0.35)'
        }}>
          🛡️
        </div>

        <h3 style={{ margin: '0 0 0.5rem', color: '#ffffff', fontSize: '1.45rem', fontWeight: 800 }}>
          {isAr ? 'التحقق الأمني من الجهاز الجديد (2FA)' : 'New Device Security Verification'}
        </h3>
        
        <p style={{ fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.8)', lineHeight: 1.6, marginBottom: '1.4rem' }}>
          {isAr ? (
            <>
              تم اكتشاف محاولة تسجيل دخول من جهاز جديد. تم إرسال رمز التحقق الأمني (OTP) إلى بريدك الإلكتروني:
              <br />
              <strong style={{ color: '#FFD700', fontSize: '0.95rem', display: 'inline-block', marginTop: '4px' }}>
                {displayEmail}
              </strong>
            </>
          ) : (
            <>
              A new device login was detected. A 6-digit security OTP was sent to your email:
              <br />
              <strong style={{ color: '#FFD700', fontSize: '0.95rem', display: 'inline-block', marginTop: '4px' }}>
                {displayEmail}
              </strong>
            </>
          )}
        </p>

        <form onSubmit={handleVerify}>
          <div style={{ marginBottom: '1.2rem' }}>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoFocus
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="• • • • • •"
              style={{
                width: '100%',
                maxWidth: '300px',
                fontSize: '2rem',
                letterSpacing: '10px',
                textAlign: 'center',
                padding: '0.75rem 1rem',
                borderRadius: '14px',
                border: '2px solid rgba(255, 215, 0, 0.45)',
                background: 'rgba(7, 9, 17, 0.95)',
                color: '#00e0a1',
                fontWeight: 800,
                outline: 'none',
                boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.6)',
                transition: 'border-color 0.2s'
              }}
            />
          </div>

          {errorMsg && (
            <div style={{
              background: 'rgba(255, 92, 92, 0.12)',
              border: '1px solid rgba(255, 92, 92, 0.3)',
              borderRadius: '10px',
              padding: '0.6rem 0.8rem',
              color: '#ff6b6b',
              fontSize: '0.85rem',
              marginBottom: '1rem',
              fontWeight: 600
            }}>
              ⚠️ {errorMsg}
            </div>
          )}

          {resendSuccessMsg && (
            <div style={{
              background: 'rgba(0, 224, 161, 0.12)',
              border: '1px solid rgba(0, 224, 161, 0.3)',
              borderRadius: '10px',
              padding: '0.6rem 0.8rem',
              color: '#00e0a1',
              fontSize: '0.85rem',
              marginBottom: '1rem',
              fontWeight: 600
            }}>
              ✓ {resendSuccessMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={verifying || code.length !== 6}
            style={{
              width: '100%',
              padding: '0.9rem',
              borderRadius: '14px',
              border: 'none',
              background: 'linear-gradient(135deg, #FFD700, #F5B041)',
              color: '#120d03',
              fontSize: '1.05rem',
              fontWeight: 800,
              cursor: verifying || code.length !== 6 ? 'not-allowed' : 'pointer',
              opacity: verifying || code.length !== 6 ? 0.6 : 1,
              transition: 'all 0.2s ease',
              boxShadow: '0 4px 18px rgba(255, 215, 0, 0.3)',
              marginBottom: '1rem'
            }}
          >
            {verifying
              ? (isAr ? 'جاري التحقق...' : 'Verifying...')
              : (isAr ? 'تأكيد وتوثيق الجهاز 🛡️' : 'Authorize & Trust Device 🛡️')}
          </button>
        </form>

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          paddingTop: '1rem',
          fontSize: '0.85rem'
        }}>
          <button
            type="button"
            onClick={handleResend}
            disabled={resending || resendCooldown > 0}
            style={{
              background: 'none',
              border: 'none',
              color: resendCooldown > 0 ? '#636e72' : '#FFD700',
              cursor: resendCooldown > 0 ? 'default' : 'pointer',
              textDecoration: resendCooldown > 0 ? 'none' : 'underline',
              fontWeight: 600,
              fontSize: '0.85rem',
              padding: 0
            }}
          >
            {resending
              ? (isAr ? 'جاري الإرسال...' : 'Sending...')
              : resendCooldown > 0
                ? (isAr ? `إعادة الإرسال بعد (${resendCooldown} ث)` : `Resend in (${resendCooldown}s)`)
                : (isAr ? '✉️ إعادة إرسال رمز التحقق' : '✉️ Resend Security Code')}
          </button>

          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              style={{
                background: 'none',
                border: 'none',
                color: '#ff7675',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: 600,
                padding: 0
              }}
            >
              {isAr ? 'تسجيل الخروج' : 'Sign Out'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
