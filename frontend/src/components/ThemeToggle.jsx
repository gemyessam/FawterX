import { Sun, Moon } from 'lucide-react'

export default function ThemeToggle({ theme = 'light', onToggle, lang }) {
  const dark = theme === 'dark'
  const label = lang === 'ar' ? (dark ? 'الوضع الفاتح' : 'الوضع الداكن') : (dark ? 'Light mode' : 'Dark mode')
  return <button type="button" className="fx-icon-button fx-theme-toggle" onClick={onToggle} title={label} aria-label={label}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
}
