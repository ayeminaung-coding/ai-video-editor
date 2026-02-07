// main.tsx - Main Entry Point
// React application entry point

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';

// Create root element
const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

// Create React root
const root = ReactDOM.createRoot(rootElement);

// Render the application
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);