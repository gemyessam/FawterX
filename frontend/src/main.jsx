import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import AmbientSkyBackground from './components/AmbientSkyBackground'
import './index.css'
import './workspace-design.css'
import './light-theme.css'
import './interface-surfaces.css'
import './calm-theme.css'
import './sky-motion.css'
import './theme-transition.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AmbientSkyBackground />
    <App />
  </React.StrictMode>
)
