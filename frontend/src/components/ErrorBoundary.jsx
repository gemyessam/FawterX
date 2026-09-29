import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      const isAr = this.props.isAr !== false
      return (
        <div
          className="card fade-in"
          style={{
            padding: '2rem',
            background: 'rgba(255, 71, 87, 0.08)',
            border: '1px solid rgba(255, 71, 87, 0.3)',
            borderRadius: '12px',
            textAlign: 'center',
            margin: '1.5rem 0',
          }}
        >
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>⚠️</div>
          <h4 style={{ color: '#ff6b81', margin: '0 0 0.5rem', fontWeight: 800, fontSize: '1.1rem' }}>
            {isAr ? 'تعذر عرض هذا القسم مؤقتاً' : 'Temporarily unable to render this section'}
          </h4>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
            {this.state.error?.message || (isAr ? 'حدث خطأ في معالجة البيانات.' : 'An unexpected error occurred.')}
          </p>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={this.handleReset}
            style={{ borderRadius: '8px', padding: '0.5rem 1.25rem', fontWeight: 600 }}
          >
            🔄 {isAr ? 'إعادة تحميل القسم' : 'Reload Section'}
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
