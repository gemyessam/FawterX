import React, { useState } from 'react'
import { verifyAuthSecurityCode } from '../services/api'

export default function Security2FAModal({ isOpen, userEmail, challengeDemoCode, onVerifySuccess, lang = 'ar' }) {
  const isAr = lang === 'ar'
  const [code, setCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  if (!isOpen) return null

  const handleVerify = async (e) => {
    e.preventDefault()
    if (!code || code.trim().length !== 6) {
      setErrorMsg(isAr ? 'برجاء إدخال رمز الأمان المكون من 6 أرقام كاملة.' : 'Please enter the full 6-digit security verification code.')
      return
    }

    setVerifying(true)
    setErrorMsg('')

    try {
      const data = await verifyAuthSecurityCode(code.trim())
      if (data.success) {
        onVerifySuccess()
      } else {
        setErrorMsg(data.message || (isAr ? 'رمز الأمان غير صحيح' : 'Invalid security code'))
      }
    } catch (err) {
      setErrorMsg(err.message || (isAr ? 'حدث خطأ أثناء الاتصال بالسيرفر' : 'Network error verifying code'))
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
      background: 'rgba(5, 7, 15, 0.88)',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      padding: '1rem'
    }}>
      <div style={{
        background: 'linear-gradient(145deg, rgba(20, 24, 40, 0.95), rgba(12, 14, 26, 0.98))',
        border: '1px solid rgba(255, 215, 0, 0.35)',
        borderRadius: '20px',
        maxWidth: '460px',
        width: '100%',
        padding: '2.2rem 1.8rem',
        boxShadow: '0 15px 40px rgba(0, 0, 0, 0.8), 0 0 25px rgba(255, 215, 0, 0.15)',
        textAlign: 'center',
        direction: isAr ? 'rtl' : 'ltr'
      }}>
        <div style={{
          width: '70px',
          height: '70px',
          margin: '0 auto 1.2rem',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255, 215, 0, 0.2), rgba(0, 224, 161, 0.05))',
          border: '2px solid #FFD700',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '2.2rem',
          boxShadow: '0 0 20px rgba(255, 215, 0, 0.4)'
        }}>
          🛡️
        </div>

        <h3 style={{ margin: '0 0 0.5rem', color: '#ffffff', fontSize: '1.4rem', fontWeight: 800 }}>
          {isAr ? 'تأكيد أمان الجهاز الجديد (2FA)' : 'New Device Security Verification'}
        </h3>
        
        <p style={{ fontSize: '0.88rem', color: 'rgba(255, 255, 255, 0.75)', lineHeight: 1.6, marginBottom: '1.2rem' }}>
          {isAr
            ? `تم اكتشاف محاولة دخول من متصفح/جهاز جديد لحساب (${userEmail}). يُرجى إدخال رمز التحقق الأمني المكون من 6 أرقام لتوثيق هذا الجهاز.`
            : `New device login detected for (${userEmail}). Please enter the 6-digit security code to trust this device.`}
        </p>

        {challengeDemoCode && (
          <div style={{
            background: 'rgba(255, 215, 0, 0.08)',
            border: '1px dashed rgba(255, 215, 0, 0.4)',
            borderRadius: '12px',
            padding: '0.6rem 1rem',
            marginBottom: '1.2rem',
            fontSize: '0.82rem',
            color: '#FFE066'
          }}>
            🔑 {isAr ? 'رمز الأمان المولد للجهاز الجديد:' : 'Generated Security Code:'}{' '}
            <strong style={{ fontSize: '1.1rem', letterSpacing: '2px', color: '#ffffff' }}>{challengeDemoCode}</strong>
          </div>
        )}

        <form onSubmit={handleVerify}>
          <input
            type="text"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="• • • • • •"
            style={{
              width: '80%',
              fontSize: '1.8rem',
              letterSpacing: '8px',
              textAlign: 'center',
              padding: '0.6rem',
              borderRadius: '12px',
              border: '2px solid rgba(255, 215, 0, 0.4)',
              background: 'rgba(10, 12, 22, 0.9)',
              color: '#00e0a1',
              fontWeight: 800,
              outline: 'none',
              marginBottom: '1rem',
              boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.5)'
            }}
          />

          {errorMsg && (
            <div style={{ color: '#ff5c5c', fontSize: '0.85rem', marginBottom: '1rem', fontWeight: 600 }}>
              ⚠️ {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={verifying || code.length !== 6}
            style={{
              width: '100%',
              padding: '0.85rem',
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(135deg, #FFD700, #F5B041)',
              color: '#120d03',
              fontSize: '1rem',
              fontWeight: 800,
              cursor: verifying || code.length !== 6 ? 'not-allowed' : 'pointer',
              opacity: verifying || code.length !== 6 ? 0.6 : 1,
              transition: 'all 0.2s ease',
              boxShadow: '0 4px 15px rgba(255, 215, 0, 0.3)'
            }}
          >
            {verifying ? (isAr ? 'جاري التحقق...' : 'Verifying...') : (isAr ? 'تأكيد وتوثيق الجهاز 🛡️' : 'Authorize & Trust Device 🛡️')}
          </button>
        </form>
      </div>
    </div>
  )
}
