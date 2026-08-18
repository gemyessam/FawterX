import React, { useState } from 'react'
import { verifyAuthSecurityCode } from '../services/api'

export default function Security2FAModal({
  isOpen,
  userEmail,
  needsTotpSetup = false,
  qrCode = '',
  secretText = '',
  onVerifySuccess,
  onLogout,
  lang = 'ar'
}) {
  const isAr = lang === 'ar'
  const [code, setCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [copiedSecret, setCopiedSecret] = useState(false)

  if (!isOpen) return null

  const handleCopySecret = () => {
    if (secretText) {
      navigator.clipboard.writeText(secretText)
      setCopiedSecret(true)
      setTimeout(() => setCopiedSecret(false), 2500)
    }
  }

  const handleVerify = async (e) => {
    e.preventDefault()
    if (!code || code.trim().length !== 6) {
      setErrorMsg(isAr ? 'برجاء إدخال رمز المصادقة المكون من 6 أرقام كاملة.' : 'Please enter the full 6-digit authenticator code.')
      return
    }

    setVerifying(true)
    setErrorMsg('')

    try {
      const data = await verifyAuthSecurityCode(code.trim())
      if (data.success) {
        onVerifySuccess()
      } else {
        setErrorMsg(data.message || (isAr ? 'رمز المصادقة غير صحيح' : 'Invalid authenticator code'))
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message
      setErrorMsg(msg || (isAr ? 'حدث خطأ أثناء التحقق من الرمز' : 'Error verifying authenticator code'))
    } finally {
      setVerifying(false)
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
      padding: '1rem',
      overflowY: 'auto'
    }}>
      <div style={{
        background: 'linear-gradient(145deg, rgba(20, 24, 40, 0.98), rgba(10, 12, 22, 0.99))',
        border: '1px solid rgba(255, 215, 0, 0.35)',
        borderRadius: '24px',
        maxWidth: '480px',
        width: '100%',
        padding: '2.2rem 1.8rem',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.9), 0 0 30px rgba(255, 215, 0, 0.12)',
        textAlign: 'center',
        direction: isAr ? 'rtl' : 'ltr',
        maxHeight: '90vh',
        overflowY: 'auto'
      }}>
        {/* Security Shield Icon */}
        <div style={{
          width: '68px',
          height: '68px',
          margin: '0 auto 1rem',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255, 215, 0, 0.25), rgba(0, 224, 161, 0.08))',
          border: '2px solid #FFD700',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '2.2rem',
          boxShadow: '0 0 25px rgba(255, 215, 0, 0.35)'
        }}>
          📱
        </div>

        <h3 style={{ margin: '0 0 0.4rem', color: '#ffffff', fontSize: '1.35rem', fontWeight: 800 }}>
          {needsTotpSetup
            ? (isAr ? 'ربط التحقق بخطوتين (Google Authenticator)' : 'Setup 2FA Authenticator App')
            : (isAr ? 'تأكيد أمان الجهاز الجديد (2FA)' : 'New Device 2FA Verification')}
        </h3>

        <p style={{ fontSize: '0.86rem', color: 'rgba(255, 255, 255, 0.75)', lineHeight: 1.6, marginBottom: '1.2rem' }}>
          {needsTotpSetup ? (
            isAr ? (
              <>
                امسح رمز الـ <strong>QR</strong> التالي باستخدام تطبيق <strong>Google Authenticator</strong> أو أي تطبيق مصادقة على هاتفك، ثم اكتب الرمز المكون من 6 أرقام للتفعيل:
              </>
            ) : (
              <>
                Scan the QR code below with <strong>Google Authenticator</strong> on your phone, then enter the 6-digit code to activate:
              </>
            )
          ) : (
            isAr ? (
              <>
                تم اكتشاف دخول من جهاز جديد لحساب (<strong style={{ color: '#FFD700' }}>{userEmail}</strong>).<br />
                أدخل الرمز المكون من 6 أرقام الظاهر في تطبيق <strong>Google Authenticator</strong> على هاتفك:
              </>
            ) : (
              <>
                New device login detected for (<strong style={{ color: '#FFD700' }}>{userEmail}</strong>).<br />
                Enter the 6-digit code from your <strong>Google Authenticator</strong> app:
              </>
            )
          )}
        </p>

        {/* QR Code section for Setup Mode */}
        {needsTotpSetup && qrCode && (
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: '0.75rem',
            display: 'inline-block',
            margin: '0 auto 1rem',
            boxShadow: '0 8px 25px rgba(0,0,0,0.5)'
          }}>
            <img
              src={qrCode}
              alt="Google Authenticator QR Code"
              style={{
                width: '180px',
                height: '180px',
                display: 'block',
                borderRadius: '8px'
              }}
            />
          </div>
        )}

        {/* Secret Key manual entry fallback */}
        {needsTotpSetup && secretText && (
          <div style={{
            background: 'rgba(255, 215, 0, 0.06)',
            border: '1px dashed rgba(255, 215, 0, 0.3)',
            borderRadius: '10px',
            padding: '0.5rem 0.8rem',
            marginBottom: '1.2rem',
            fontSize: '0.8rem',
            color: '#e8eaf6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5rem'
          }}>
            <span style={{ fontSize: '0.75rem', color: '#a4b0be' }}>
              {isAr ? 'أو أدخل المفتاح يدوياً:' : 'Or manual key:'}
            </span>
            <code style={{ color: '#FFD700', fontWeight: 700, letterSpacing: '1px', fontSize: '0.85rem' }}>
              {secretText}
            </code>
            <button
              type="button"
              onClick={handleCopySecret}
              style={{
                background: 'rgba(255, 215, 0, 0.15)',
                border: '1px solid rgba(255, 215, 0, 0.3)',
                color: '#FFD700',
                borderRadius: '6px',
                padding: '0.2rem 0.5rem',
                fontSize: '0.75rem',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              {copiedSecret ? (isAr ? 'تم النسخ ✓' : 'Copied ✓') : (isAr ? 'نسخ' : 'Copy')}
            </button>
          </div>
        )}

        {/* OTP Input Form */}
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
                maxWidth: '280px',
                fontSize: '2rem',
                letterSpacing: '10px',
                textAlign: 'center',
                padding: '0.65rem 1rem',
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

          <button
            type="submit"
            disabled={verifying || code.length !== 6}
            style={{
              width: '100%',
              padding: '0.85rem',
              borderRadius: '14px',
              border: 'none',
              background: 'linear-gradient(135deg, #FFD700, #F5B041)',
              color: '#120d03',
              fontSize: '1rem',
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
              : needsTotpSetup
                ? (isAr ? 'تفعيل وتوثيق الجهاز 🛡️' : 'Activate & Trust Device 🛡️')
                : (isAr ? 'تأكيد وتوثيق الجهاز 🛡️' : 'Authorize & Trust Device 🛡️')}
          </button>
        </form>

        {onLogout && (
          <div style={{
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            paddingTop: '0.8rem',
            fontSize: '0.85rem'
          }}>
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
          </div>
        )}
      </div>
    </div>
  )
}
