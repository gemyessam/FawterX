import { useEffect, useMemo, useState, useContext } from 'react'
import toast from 'react-hot-toast'
import { AppContext } from '../App'
import { getAdminStats, getAdminUsers, updateAdminUser } from '../services/api'

const ADMIN_EMAIL = 'gemy.essam.ge@gmail.com'

const emptyForm = {
  role: 'user',
  status: 'active',
  isSubscribed: false,
  quotaDaily: 10,
  quotaMonthly: '',
  expiresAt: '',
  note: '',
}

export default function AdminPanel() {
  const { lang, user } = useContext(AppContext)
  const [stats, setStats] = useState({ totalUsers: 0, subscribedUsers: 0, suspendedUsers: 0, adminUsers: 0 })
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(emptyForm)

  const isAdmin = (user?.email || '').toLowerCase() === ADMIN_EMAIL
  const selectedQuotaDaily = selected?.quotaDaily ?? 10
  const selectedUsed = selected?.submissionsCount || 0
  const selectedRemaining = Math.max(0, selectedQuotaDaily - selectedUsed)

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false)
      return
    }
    loadData()
  }, [isAdmin])

  async function loadData() {
    setLoading(true)
    try {
      const [statsRes, usersRes] = await Promise.all([getAdminStats(), getAdminUsers()])
      if (statsRes?.success && statsRes.stats) setStats(statsRes.stats)
      if (usersRes?.success && usersRes.users) setUsers(usersRes.users)
    } catch (error) {
      toast.error(lang === 'ar' ? 'فشل تحميل لوحة الإدارة' : 'Failed to load admin panel')
    } finally {
      setLoading(false)
    }
  }

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return users
    return users.filter((u) =>
      [u.email, u.displayName, u.uid, u.role, u.status].some((value) => String(value || '').toLowerCase().includes(q))
    )
  }, [users, query])

  function selectUser(u) {
    setSelected(u)
    setForm({
      role: u.role || 'user',
      status: u.status || 'active',
      isSubscribed: Boolean(u.isSubscribed),
      quotaDaily: u.quotaDaily ?? 10,
      quotaMonthly: u.quotaMonthly ?? '',
      expiresAt: u.expiresAt || '',
      note: u.note || '',
    })
  }

  async function handleSave() {
    if (!selected) return
    setSaving(true)
    try {
      const payload = {
        role: form.role,
        status: form.status,
        isSubscribed: form.isSubscribed,
        quotaDaily: Number(form.quotaDaily),
        quotaMonthly: form.quotaMonthly === '' ? null : Number(form.quotaMonthly),
        expiresAt: form.expiresAt || null,
        note: form.note,
      }
      const res = await updateAdminUser(selected.uid, payload)
      if (res?.success && res.user) {
        setUsers((prev) => prev.map((u) => (u.uid === res.user.uid ? res.user : u)))
        setSelected(res.user)
        toast.success(lang === 'ar' ? 'تم حفظ التعديلات' : 'Changes saved')
        await loadData()
      }
    } catch (error) {
      toast.error(error.response?.data?.message || (lang === 'ar' ? 'فشل الحفظ' : 'Save failed'))
    } finally {
      setSaving(false)
    }
  }

  if (!isAdmin) {
    return (
      <div className="card fade-in" style={{ padding: '2rem' }}>
        <h2 className="card-title">Admin Panel</h2>
        <p className="card-sub" style={{ marginBottom: 0 }}>
          {lang === 'ar'
            ? 'هذه الصفحة متاحة للحساب الإداري فقط.'
            : 'This area is restricted to the approved administrator account.'}
        </p>
      </div>
    )
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '5rem' }}><span className="spinner"></span></div>
  }

  return (
    <div className="admin-console-shell fade-in">
      <div className="card admin-hero-card">
        <div className="admin-hero-copy">
          <h2 className="card-title" style={{ marginBottom: '0.35rem' }}>
            {lang === 'ar' ? '???? ?????? ????????' : 'Admin Console'}
          </h2>
          <p className="card-sub" style={{ marginBottom: 0, maxWidth: '72ch' }}>
            {lang === 'ar'
              ? '????? ????????? ?????? ??????????? ????????? ????????? ?? ???? ????? ?????.'
              : 'Manage permissions, quotas, subscriptions, and operational user data from one focused workspace.'}
          </p>
          <div className="admin-admin-chip">
            <span>?</span>
            <span>{lang === 'ar' ? '?????? ??????' : 'Approved admin account'}</span>
            <strong>{ADMIN_EMAIL}</strong>
          </div>
        </div>
        <button className="btn btn-accent" onClick={loadData}>
          {lang === 'ar' ? '????? ????????' : 'Refresh data'}
        </button>
      </div>

      <div className="admin-kpi-grid">
        {[
          { label: lang === 'ar' ? '?????? ??????????' : 'Total users', value: stats.totalUsers },
          { label: lang === 'ar' ? '?????????? ??????' : 'Active subscriptions', value: stats.subscribedUsers },
          { label: lang === 'ar' ? '???????? ????????' : 'Suspended users', value: stats.suspendedUsers },
          { label: lang === 'ar' ? '?????? ??????' : 'Admin accounts', value: stats.adminUsers },
        ].map((item) => (
          <div className="card admin-kpi-card" key={item.label}>
            <div className="admin-kpi-label">{item.label}</div>
            <div className="admin-kpi-value">{item.value}</div>
          </div>
        ))}
      </div>

      <div className="admin-workspace">
        <div className="card admin-left-panel">
          <div className="admin-user-summary">
            {selected ? (
              <>
                <div className="admin-user-detail-head">
                  <div>
                    <h3 className="admin-user-detail-name">{selected.displayName || selected.email || selected.uid}</h3>
                    <div className="admin-user-detail-sub">
                      <span>{selected.email || (lang === 'ar' ? '?? ???? ???? ?????' : 'No saved email')}</span>
                      <span>{selected.uid}</span>
                    </div>
                  </div>
                  <span className="admin-pill">{selected.status || 'active'}</span>
                </div>

                <div className="admin-user-badge-row">
                  <span className="admin-user-badge">
                    <span>{lang === 'ar' ? '?????' : 'Role'}:</span>
                    <strong>{selected.role || 'user'}</strong>
                  </span>
                  <span className="admin-user-badge">
                    <span>{lang === 'ar' ? '??????' : 'Subscription'}:</span>
                    <strong>{selected.isSubscribed ? (lang === 'ar' ? '???' : 'Active') : (lang === 'ar' ? '??' : 'No')}</strong>
                  </span>
                </div>
              </>
            ) : (
              <div className="admin-empty-state">
                {lang === 'ar' ? '????? ???????? ?? ?????? ????? ??????? ???.' : 'Select a user from the table to see details here.'}
              </div>
            )}
          </div>

          {selected && (
            <>
              <div className="admin-metrics-two">
                <div className="admin-mini-card">
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{lang === 'ar' ? '????????' : 'Used'}</div>
                  <div style={{ fontSize: '1.55rem', fontWeight: 800, marginTop: '0.2rem' }}>{selectedUsed}</div>
                </div>
                <div className="admin-mini-card accent">
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{lang === 'ar' ? '???????' : 'Remaining'}</div>
                  <div style={{ fontSize: '1.55rem', fontWeight: 800, marginTop: '0.2rem', color: 'var(--accent)' }}>{selectedRemaining}</div>
                </div>
              </div>

              <div className="admin-form-grid">
                <div className="admin-field">
                  <label>{lang === 'ar' ? '?????' : 'Role'}</label>
                  <select value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}>
                    <option value="user">user</option>
                    <option value="admin">admin</option>
                    <option value="suspended">suspended</option>
                  </select>
                </div>

                <div className="admin-field">
                  <label>{lang === 'ar' ? '??????' : 'Status'}</label>
                  <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
                    <option value="active">active</option>
                    <option value="suspended">suspended</option>
                    <option value="blocked">blocked</option>
                  </select>
                </div>

                <div className="admin-field" style={{ gridColumn: '1 / -1' }}>
                  <label>{lang === 'ar' ? '???????? ?????' : 'Active subscription'}</label>
                  <div className="admin-mini-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{lang === 'ar' ? '??? ??? ?????? ?????? ??????? ???????' : 'Allow this account to submit directly'}</span>
                    <input
                      type="checkbox"
                      checked={form.isSubscribed}
                      onChange={(e) => setForm((p) => ({ ...p, isSubscribed: e.target.checked }))}
                      style={{ width: '18px', height: '18px', accentColor: 'var(--accent)' }}
                    />
                  </div>
                </div>

                <div className="admin-field">
                  <label>{lang === 'ar' ? '???? ??????' : 'Daily quota'}</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.quotaDaily}
                    onChange={(e) => setForm((p) => ({ ...p, quotaDaily: e.target.value }))}
                  />
                </div>

                <div className="admin-field">
                  <label>{lang === 'ar' ? '???? ??????' : 'Monthly quota'}</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.quotaMonthly}
                    onChange={(e) => setForm((p) => ({ ...p, quotaMonthly: e.target.value }))}
                  />
                </div>

                <div className="admin-field">
                  <label>{lang === 'ar' ? '?????? ????????' : 'Expires at'}</label>
                  <input
                    type="date"
                    value={form.expiresAt}
                    onChange={(e) => setForm((p) => ({ ...p, expiresAt: e.target.value }))}
                  />
                </div>

                <div className="admin-field">
                  <label>{lang === 'ar' ? '???????' : 'Notes'}</label>
                  <textarea
                    rows="4"
                    value={form.note}
                    onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
                  />
                </div>
              </div>

              <div className="admin-form-actions">
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? <span className="spinner"></span> : (lang === 'ar' ? '??? ?????????' : 'Save changes')}
                </button>
              </div>
            </>
          )}
        </div>

        <div className="card admin-right-panel">
          <div className="admin-table-header">
            <div className="admin-table-title">
              <h3>{lang === 'ar' ? '????? ????? ??????????' : 'User access workspace'}</h3>
              <p>{lang === 'ar' ? '????? ????? ?? ??? ????????? ??????????? ?? ??? ??????.' : 'Search, review, and update permissions from one workspace.'}</p>
            </div>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={lang === 'ar' ? '???? ?????? ?? ?????? ?? UID' : 'Search by name, email, or UID'}
              className="admin-search"
              style={{ minWidth: '280px', maxWidth: '420px' }}
            />
          </div>

          <div className="admin-table-shell">
            <table>
              <thead>
                <tr>
                  <th style={{ minWidth: '260px' }}>{lang === 'ar' ? '?????? / ??????' : 'Account / Email'}</th>
                  <th>{lang === 'ar' ? '?????' : 'Role'}</th>
                  <th>{lang === 'ar' ? '??????' : 'Status'}</th>
                  <th>{lang === 'ar' ? '???? ??????' : 'Daily'}</th>
                  <th>{lang === 'ar' ? '????????' : 'Used'}</th>
                  <th>{lang === 'ar' ? '???????' : 'Remaining'}</th>
                  <th>{lang === 'ar' ? '??????' : 'Subs'}</th>
                  <th>{lang === 'ar' ? '?????' : 'Action'}</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length ? filteredUsers.map((u) => {
                  const quota = u.quotaDaily ?? 10
                  const used = u.submissionsCount || 0
                  const remaining = Math.max(0, quota - used)
                  return (
                    <tr key={u.uid} style={{ background: selected?.uid === u.uid ? 'rgba(0, 224, 161, 0.08)' : 'transparent' }}>
                      <td>
                        <div style={{ fontWeight: 700, lineHeight: 1.25 }}>{u.displayName || '?'}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', wordBreak: 'break-word', marginTop: '0.25rem' }}>{u.email || u.uid}</div>
                        <div style={{ color: 'var(--text-dim)', fontSize: '0.72rem', marginTop: '0.2rem', wordBreak: 'break-all' }}>{u.uid}</div>
                      </td>
                      <td><span className="badge badge-valid" style={{ textTransform: 'uppercase' }}>{u.role || 'user'}</span></td>
                      <td><span className="badge" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}>{u.status || 'active'}</span></td>
                      <td>{quota}</td>
                      <td>{used}</td>
                      <td style={{ fontWeight: 'bold', color: remaining > 0 ? 'var(--accent)' : '#ff4d4f' }}>{remaining}</td>
                      <td>{u.isSubscribed ? (lang === 'ar' ? '???' : 'Yes') : (lang === 'ar' ? '??' : 'No')}</td>
                      <td>
                        <button className="btn btn-ghost btn-sm" onClick={() => selectUser(u)}>
                          {lang === 'ar' ? '?????' : 'Edit'}
                        </button>
                      </td>
                    </tr>
                  )
                }) : (
                  <tr>
                    <td colSpan="8" className="admin-empty-state">
                      {lang === 'ar' ? '?? ???? ????? ?????? ????? ??????.' : 'No users match the current search.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )

}
