import React, { useEffect, useState, Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import Dashboard from './Dashboard.jsx'

// Lazy-load Explore so the heavy DuckDB-WASM bundle is only fetched
// when someone actually navigates to /explore. The main dashboard
// stays light.
const Explore = lazy(() => import('./Explore.jsx'));

// Minimal hash-based routing. No router library needed — we have only
// two pages. Hash routes work everywhere (Vercel, Netlify, GitHub Pages,
// even file://) without any server config.
function App() {
  const [route, setRoute] = useState(() => window.location.hash || '#/');
  useEffect(() => {
    const onHashChange = () => setRoute(window.location.hash || '#/');
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  if (route.startsWith('#/explore')) {
    return (
      <Suspense
        fallback={
          <div
            style={{
              minHeight: '100vh',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#f6f1e7',
              fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
              color: '#6b6155',
            }}
          >
            Loading SQL console…
          </div>
        }
      >
        <Explore />
      </Suspense>
    );
  }
  return <Dashboard />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
