import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './style.css';

// Ensure DOM is fully loaded before rendering
document.addEventListener('DOMContentLoaded', () => {
  const rootElement = document.getElementById('root');
  
  if (rootElement) {
    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } else {
    console.error('Root element not found');
  }
});
