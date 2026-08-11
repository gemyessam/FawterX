import { useEffect, useMemo, useState, useContext } from 'react'
import toast from 'react-hot-toast'
import { AppContext } from '../App'
import { getAdminStats, getAdminUsers, updateAdminUser } from '../services/api'

const ADMIN_EMAIL = 'gemy.essam.ge@gmail.com'

const L = {
  ar: {
    forbiddenTitle: '\u0644\u0648\u062d\u0629 \u0627\u0644\u062a\u062d\u0643\u0645 \u0627\u0644\u0625\u062f\u0627\u0631\u064a\u0629',
    forbiddenBody: '\u0647\u0630\u0647 \u0627\u0644\u0635\u0641\u062d\u0629 \u0645\u062a\u0627\u062d\u0629 \u0644\u0644\u062d\u0633\u0627\u0628 \u0627\u0644\u0625\u062f\u0627\u0631\u064a \u0641\u0642\u0637.',
    heroTitle: '\u0644\u0648\u062d\u0629 \u0627\u0644\u062a\u062d\u0643\u0645 \u0627\u0644\u0625\u062f\u0627\u0631\u064a\u0629',
    heroSub: '\u0625\u062f\u0627\u0631\u0629 \u0627\u0644\u0635\u0644\u0627\u062d\u064a\u0627\u062a \u0648\u0627\u0644\u062d\u0635\u0635 \u0648\u0627\u0644\u0627\u0634\u062a\u0631\u0627\u0643\u0627\u062a \u0648\u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a \u0627\u0644\u062a\u0634\u063a\u064a\u0644\u064a\u0629 \u0645\u0646 \u0634\u0627\u0634\u0629 \u0648\u0627\u062d\u062f\u0629 \u0648\u0627\u0636\u062d\u0629.',
    approvedAdmin: '\u0627\u0644\u062d\u0633\u0627\u0628 \u0627\u0644\u0645\u0635\u0631\u062d',
    refresh: '\u062a\u062d\u062f\u064a\u062b \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a',
    totalUsers: '\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645\u064a\u0646',
    activeSubs: '\u0627\u0644\u0627\u0634\u062a\u0631\u0627\u0643\u0627\u062a \u0627\u0644\u0646\u0634\u0637\u0629',
    suspended: '\u0627\u0644\u062d\u0633\u0627\u0628\u0627\u062a \u0627\u0644\u0645\u0648\u0642\u0648\u0641\u0629',
    admins: '\u062d\u0633\u0627\u0628\u0627\u062a \u0627\u0644\u0623\u062f\u0645\u0646',
    selectedHint: '\u0627\u062e\u062a\u0631 \u0645\u0633\u062a\u062e\u062f\u0645\u064b\u0627 \u0644\u062a\u0638\u0647\u0631 \u062a\u0641\u0627\u0635\u064a\u0644\u0647 \u0647\u0646\u0627.',
    role: '\u0627\u0644\u062f\u0648\u0631',
    subscription: '\u0627\u0644\u0627\u0634\u062a\u0631\u0627\u0643',
    yes: '\u0646\u0639\u0645',
    no: '\u0644\u0627',
    used: '\u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645',
    remaining: '\u0627\u0644\u0645\u062a\u0628\u0642\u064a',
    status: '\u0627\u0644\u062d\u0627\u0644\u0629',
    activeSubscription: '\u0627\u0644\u0627\u0634\u062a\u0631\u0627\u0643 \u0627\u0644\u0646\u0634\u0637',
    subscriptionHelp: '\u0645\u0646\u062d \u0647\u0630\u0627 \u0627\u0644\u062d\u0633\u0627\u0628 \u0635\u0644\u0627\u062d\u064a\u0629 \u0627\u0644\u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u0645\u0628\u0627\u0634\u0631',
    dailyQuota: '\u0627\u0644\u062d\u062f \u0627\u0644\u064a\u0648\u0645\u064a',
    monthlyQuota: '\u0627\u0644\u062d\u062f \u0627\u0644\u0634\u0647\u0631\u064a',
    expiresAt: '\u0627\u0646\u062a\u0647\u0627\u0621 \u0627\u0644\u0635\u0644\u0627\u062d\u064a\u0629',
    notes: '\u0645\u0644\u0627\u062d\u0638\u0627\u062a',
    save: '\u062d\u0641\u0638 \u0627\u0644\u062a\u063a\u064a\u064a\u0631\u0627\u062a',
    searchTitle: '\u0644\u0648\u062d\u0629 \u0625\u062f\u0627\u0631\u0629 \u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645\u064a\u0646',
    searchSub: '\u0627\u0628\u062d\u062b\u060c \u0631\u0627\u062c\u0639\u060c \u062b\u0645 \u0639\u062f\u0644 \u0627\u0644\u0635\u0644\u0627\u062d\u064a\u0627\u062a \u0648\u0627\u0644\u0627\u0634\u062a\u0631\u0627\u0643\u0627\u062a \u0645\u0646 \u0646\u0641\u0633 \u0627\u0644\u0634\u0627\u0634\u0629.',
    searchPlaceholder: '\u0627\u0628\u062d\u062b \u0628\u0627\u0644\u0627\u0633\u0645 \u0623\u0648 \u0627\u0644\u0628\u0631\u064a\u062f \u0623\u0648 UID',
    accountEmail: '\u0627\u0644\u062d\u0633\u0627\u0628 / \u0627\u0644\u0628\u0631\u064a\u062f',
    action: '\u0625\u062c\u0631\u0627\u0621',
    noEmail: '\u0644\u0627 \u064a\u0648\u062c\u062f \u0628\u0631\u064a\u062f \u0645\u062d\u0641\u0648\u0638',
    noResults: '\u0644\u0627 \u062a\u0648\u062c\u062f \u0646\u062a\u0627\u0626\u062c \u0645\u0637\u0627\u0628\u0642\u0629 \u0644\u0644\u0628\u062d\u062b \u0627\u0644\u062d\u0627\u0644\u064a.',
    loadingError: '\u0641\u0634\u0644 \u062a\u062d\u0645\u064a\u0644 \u0644\u0648\u062d\u0629 \u0627\u0644\u0625\u062f\u0627\u0631\u0629',
    saveError: '\u0641\u0634\u0644 \u0627\u0644\u062d\u0641\u0638',
    saveSuccess: '\u062a\u0645 \u062d\u0641\u0638 \u0627\u0644\u062a\u063a\u064a\u064a\u0631\u0627\u062a',
    usedLabel: '\u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645',
    remainingLabel: '\u0627\u0644\u0645\u062a\u0628\u0642\u064a',
    roleLabel: '\u0627\u0644\u062f\u0648\u0631',
    statusLabel: '\u0627\u0644\u062d\u0627\u0644\u0629',
    dailyLabel: '\u0627\u0644\u062d\u062f \u0627\u0644\u064a\u0648\u0645\u064a',
    monthlyLabel: '\u0627\u0644\u062d\u062f \u0627\u0644\u0634\u0647\u0631\u064a',
    notesLabel: '\u0645\u0644\u0627\u062d\u0638\u0627\u062a',
    edit: '\u062a\u0639\u062f\u064a\u0644',
  },
  en: {
    forbiddenTitle: 'Admin Panel',
    forbiddenBody: 'This area is restricted to the approved administrator account.',
    heroTitle: 'Admin Console',
    heroSub: 'Manage permissions, quotas, subscriptions, and operational user data from one focused workspace.',
    approvedAdmin: 'Approved admin account',
    refresh: 'Refresh data',
    totalUsers: 'Total users',
    activeSubs: 'Active subscriptions',
    suspended: 'Suspended users',
    admins: 'Admin accounts',
    selectedHint: 'Select a user from the table to see details here.',
    role: 'Role',
    subscription: 'Subscription',
    yes: 'Yes',
    no: 'No',
    used: 'Used',
    remaining: 'Remaining',
    status: 'Status',
    activeSubscription: 'Active subscription',
    subscriptionHelp: 'Allow this account to submit directly',
    dailyQuota: 'Daily quota',
    monthlyQuota: 'Monthly quota',
    expiresAt: 'Expires at',
    notes: 'Notes',
    save: 'Save changes',
    searchTitle: 'User access workspace',
    searchSub: 'Search, review, and update permissions from one workspace.',
    searchPlaceholder: 'Search by name, email, or UID',
    accountEmail: 'Account / Email',
    action: 'Action',
    noEmail: 'No saved email',
    noResults: 'No users match the current search.',
    loadingError: 'Failed to load admin panel',
    saveError: 'Save failed',
    saveSuccess: 'Changes saved',
    usedLabel: 'Used',
    remainingLabel: 'Remaining',
    roleLabel: 'Role',
    statusLabel: 'Status',
    dailyLabel: 'Daily quota',
    monthlyLabel: 'Monthly quota',
    notesLabel: 'Notes',
    edit: 'Edit',
  }
}

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
  const t = L[lang === 'ar' ? 'ar' : 'en']
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
      const statsRes = await getAdminStats().catch(err => {
        console.warn('Stats fetch error:', err)
        return null
      })
      const usersRes = await getAdminUsers().catch(err => {
        console.warn('Users fetch error:', err)
        return null
      })

      if (statsRes?.success && statsRes.stats) {
        setStats(statsRes.stats)
      }
      if (usersRes?.success && usersRes.users) {
        setUsers(usersRes.users)
      }
      if (!statsRes?.success && !usersRes?.success) {
        toast.error(t.loadingError)
      }
    } catch (error) {
      console.error(error)
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
        toast.success(t.saveSuccess)
        await loadData()
      }
    } catch (error) {
      toast.error(error.response?.data?.message || t.saveError)
    } finally {
      setSaving(false)
    }
  }

  if (!isAdmin) {
    return (
      <div className="card fade-in" style={{ padding: '2rem' }}>
        <h2 className="card-title">{t.forbiddenTitle}</h2>
        <p className="card-sub" style={{ marginBottom: 0 }}>{t.forbiddenBody}</p>
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
          <h2 className="card-title" style={{ marginBottom: '0.35rem' }}>{t.heroTitle}</h2>
          <p className="card-sub" style={{ marginBottom: 0, maxWidth: '72ch' }}>{t.heroSub}</p>
          <div className="admin-admin-chip">
            <span>●</span>
            <span>{t.approvedAdmin}</span>
            <strong>{ADMIN_EMAIL}</strong>
          </div>
        </div>
        <button className="btn btn-accent" onClick={loadData}>{t.refresh}</button>
      </div>

      <div className="admin-kpi-grid">
        {[
          { label: t.totalUsers, value: stats.totalUsers },
          { label: t.activeSubs, value: stats.subscribedUsers },
          { label: t.suspended, value: stats.suspendedUsers },
          { label: t.admins, value: stats.adminUsers },
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
                      <span>{selected.email || t.noEmail}</span>
                      <span>{selected.uid}</span>
                    </div>
                  </div>
                  <span className="admin-pill">{selected.status || 'active'}</span>
                </div>
                <div className="admin-user-badge-row">
                  <span className="admin-user-badge">
                    <span>{t.role}:</span>
                    <strong>{selected.role || 'user'}</strong>
                  </span>
                  <span className="admin-user-badge">
                    <span>{t.subscription}:</span>
                    <strong>{selected.isSubscribed ? t.yes : t.no}</strong>
                  </span>
                </div>
              </>
            ) : (
              <div className="admin-empty-state">{t.selectedHint}</div>
            )}
          </div>

          {selected && (
            <>
              <div className="admin-metrics-two">
                <div className="admin-mini-card">
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{t.usedLabel}</div>
                  <div style={{ fontSize: '1.55rem', fontWeight: 800, marginTop: '0.2rem' }}>{selectedUsed}</div>
                </div>
                <div className="admin-mini-card accent">
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{t.remainingLabel}</div>
                  <div style={{ fontSize: '1.55rem', fontWeight: 800, marginTop: '0.2rem', color: 'var(--accent)' }}>{selectedRemaining}</div>
                </div>
              </div>

              <div className="admin-form-grid">
                <div className="admin-field">
                  <label>{t.role}</label>
                  <select value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}>
                    <option value="user">user</option>
                    <option value="admin">admin</option>
                    <option value="suspended">suspended</option>
                  </select>
                </div>

                <div className="admin-field">
                  <label>{t.status}</label>
                  <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
                    <option value="active">active</option>
                    <option value="suspended">suspended</option>
                    <option value="blocked">blocked</option>
                  </select>
                </div>

                <div className="admin-field" style={{ gridColumn: '1 / -1' }}>
                  <label>{t.activeSubscription}</label>
                  <div className="admin-mini-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{t.subscriptionHelp}</span>
                    <input
                      type="checkbox"
                      checked={form.isSubscribed}
                      onChange={(e) => setForm((p) => ({ ...p, isSubscribed: e.target.checked }))}
                      style={{ width: '18px', height: '18px', accentColor: 'var(--accent)' }}
                    />
                  </div>
                </div>

                <div className="admin-field">
                  <label>{t.dailyQuota}</label>
                  <input type="number" min="0" step="1" value={form.quotaDaily} onChange={(e) => setForm((p) => ({ ...p, quotaDaily: e.target.value }))} />
                </div>

                <div className="admin-field">
                  <label>{t.monthlyQuota}</label>
                  <input type="number" min="0" step="1" value={form.quotaMonthly} onChange={(e) => setForm((p) => ({ ...p, quotaMonthly: e.target.value }))} />
                </div>

                <div className="admin-field">
                  <label>{t.expiresAt}</label>
                  <input type="date" value={form.expiresAt} onChange={(e) => setForm((p) => ({ ...p, expiresAt: e.target.value }))} />
                </div>

                <div className="admin-field">
                  <label>{t.notes}</label>
                  <textarea rows="4" value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} />
                </div>
              </div>

              <div className="admin-form-actions">
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? <span className="spinner"></span> : t.save}
                </button>
              </div>
            </>
          )}
        </div>

        <div className="card admin-right-panel">
          <div className="admin-table-header">
            <div className="admin-table-title">
              <h3>{t.searchTitle}</h3>
              <p>{t.searchSub}</p>
            </div>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.searchPlaceholder}
              className="admin-search"
              style={{ minWidth: '280px', maxWidth: '420px' }}
            />
          </div>

          <div className="admin-table-shell">
            <table>
              <thead>
                <tr>
                  <th style={{ minWidth: '260px' }}>{t.accountEmail}</th>
                  <th>{t.role}</th>
                  <th>{t.status}</th>
                  <th>{t.dailyLabel}</th>
                  <th>{t.usedLabel}</th>
                  <th>{t.remainingLabel}</th>
                  <th>{t.subscription}</th>
                  <th>{t.action}</th>
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
                        <div style={{ fontWeight: 700, lineHeight: 1.25 }}>{u.displayName || '—'}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', wordBreak: 'break-word', marginTop: '0.25rem' }}>{u.email || u.uid}</div>
                        <div style={{ color: 'var(--text-dim)', fontSize: '0.72rem', marginTop: '0.2rem', wordBreak: 'break-all' }}>{u.uid}</div>
                      </td>
                      <td><span className="badge badge-valid" style={{ textTransform: 'uppercase' }}>{u.role || 'user'}</span></td>
                      <td><span className="badge" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}>{u.status || 'active'}</span></td>
                      <td>{quota}</td>
                      <td>{used}</td>
                      <td style={{ fontWeight: 'bold', color: remaining > 0 ? 'var(--accent)' : '#ff4d4f' }}>{remaining}</td>
                      <td>{u.isSubscribed ? t.yes : t.no}</td>
                      <td>
                        <button className="btn btn-ghost btn-sm" onClick={() => selectUser(u)}>{t.edit}</button>
                      </td>
                    </tr>
                  )
                }) : (
                  <tr>
                    <td colSpan="8" className="admin-empty-state">{t.noResults}</td>
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
