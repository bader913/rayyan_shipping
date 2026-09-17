import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { BRAND } from './config/brand';
import './styles/brand.css';

// ضبط الاتجاه واللغة من الهوية
document.documentElement.lang = BRAND.locale.default;
document.documentElement.dir = BRAND.locale.direction;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
