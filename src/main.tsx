import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app';
import { initTheme } from './themes';

initTheme();
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
