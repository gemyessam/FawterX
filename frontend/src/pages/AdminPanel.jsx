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
    <div className="fade-in" style={{ display: 'grid', gap: '1.25rem' }}>
      <div className="card" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <h2 className="card-title" style={{ marginBottom: '0.35rem' }}>
              {lang === 'ar' ? 'لوحة تحكم الأدمن' : 'Admin Console'}
            </h2>
            <p className="card-sub" style={{ marginBottom: 0 }}>
              {lang === 'ar'
                ? 'إدارة الصلاحيات وعدد الاستخدامات للحسابات المسجلة.'
                : 'Manage permissions, quotas, and subscription status for registered users.'}
            </p>
          </div>
          <button className="btn btn-accent" onClick={loadData}>
            {lang === 'ar' ? 'تحديث' : 'Refresh'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '1rem' }}>
        {[
          { label: lang === 'ar' ? 'إجمالي المستخدمين' : 'Total Users', value: stats.totalUsers },
          { label: lang === 'ar' ? 'الاشتراكات النشطة' : 'Subscribed', value: stats.subscribedUsers },
          { label: lang === 'ar' ? 'الموقوفون' : 'Suspended', value: stats.suspendedUsers },
          { label: lang === 'ar' ? 'حسابات الأدمن' : 'Admins', value: stats.adminUsers },
        ].map((item) => (
          <div className="card" key={item.label} style={{ padding: '1.25rem' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{item.label}</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '0.4rem', color: 'var(--accent)' }}>{item.value}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={lang === 'ar' ? 'بحث بالاسم أو البريد أو UID' : 'Search by name, email, or UID'}
            style={{ minWidth: '280px', flex: '1', maxWidth: '420px' }}
          />
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', alignSelf: 'center' }}>
            {lang === 'ar' ? 'اختَر مستخدمًا لتعديل الصلاحيات' : 'Select a user to edit access rules'}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '1rem', alignItems: 'start' }}>
          <div className="table-wrapper" style={{ maxHeight: '70vh', overflow: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Daily</th>
                  <th>Subs</th>
                  <th>Submissions</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr key={u.uid} style={{ background: selected?.uid === u.uid ? 'rgba(0, 224, 161, 0.08)' : 'transparent' }}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{u.displayName || '—'}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{u.email || u.uid}</div>
                    </td>
                    <td>{u.role || 'user'}</td>
                    <td>{u.status || 'active'}</td>
                    <td>{u.quotaDaily ?? 10}</td>
                    <td>{u.isSubscribed ? 'Yes' : 'No'}</td>
                    <td>{u.submissionsCount || 0}</td>
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={() => selectUser(u)}>
                        {lang === 'ar' ? 'تعديل' : 'Edit'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card" style={{ padding: '1.25rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
            {selected ? (
              <>
                <h3 style={{ marginTop: 0, marginBottom: '0.5rem' }}>{selected.displayName || selected.email || selected.uid}</h3>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem', wordBreak: 'break-word' }}>{selected.uid}</div>

                <div style={{ display: 'grid', gap: '0.9rem' }}>
                  <label>
                    <div style={{ marginBottom: '0.35rem', color: 'var(--text-muted)' }}>{lang === 'ar' ? 'الدور' : 'Role'}</div>
                    <select value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}>
                      <option value="user">user</option>
                      <option value="admin">admin</option>
                      <option value="suspended">suspended</option>
                    </select>
                  </label>

                  <label>
                    <div style={{ marginBottom: '0.35rem', color: 'var(--text-muted)' }}>{lang === 'ar' ? 'الحالة' : 'Status'}</div>
                    <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
                      <option value="active">active</option>
                      <option value="suspended">suspended</option>
                      <option value="blocked">blocked</option>
                    </select>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <input
                      type="checkbox"
                      checked={form.isSubscribed}
                      onChange={(e) => setForm((p) => ({ ...p, isSubscribed: e.target.checked }))}
                      style={{ width: '18px', height: '18px' }}
                    />
                    <span>{lang === 'ar' ? 'اشتراك نشط' : 'Active subscription'}</span>
                  </label>

                  <label>
                    <div style={{ marginBottom: '0.35rem', color: 'var(--text-muted)' }}>{lang === 'ar' ? 'الحد اليومي' : 'Daily quota'}</div>
                    <input type="number" min="0" step="1" value={form.quotaDaily}
                      onChange={(e) => setForm((p) => ({ ...p, quotaDaily: e.target.value }))} />
                  </label>

                  <label>
                    <div style={{ marginBottom: '0.35rem', color: 'var(--text-muted)' }}>{lang === 'ar' ? 'الحد الشهري' : 'Monthly quota'}</div>
                    <input type="number" min="0" step="1" value={form.quotaMonthly}
                      onChange={(e) => setForm((p) => ({ ...p, quotaMonthly: e.target.value }))} />
                  </label>

                  <label>
                    <div style={{ marginBottom: '0.35rem', color: 'var(--text-muted)' }}>{lang === 'ar' ? 'انتهاء الصلاحية' : 'Expires at'}</div>
                    <input type="date" value={form.expiresAt}
                      onChange={(e) => setForm((p) => ({ ...p, expiresAt: e.target.value }))} />
                  </label>

                  <label>
                    <div style={{ marginBottom: '0.35rem', color: 'var(--text-muted)' }}>{lang === 'ar' ? 'ملاحظات' : 'Notes'}</div>
                    <textarea rows="4" value={form.note}
                      onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} />
                  </label>

                  <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                    {saving ? <span className="spinner"></span> : (lang === 'ar' ? 'حفظ التغييرات' : 'Save Changes')}
                  </button>
                </div>
              </>
            ) : (
              <div style={{ color: 'var(--text-muted)' }}>
                {lang === 'ar' ? 'اختَر مستخدمًا من الجدول لبدء التعديل.' : 'Pick a user from the table to start editing.'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
