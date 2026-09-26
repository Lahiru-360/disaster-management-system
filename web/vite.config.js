import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// React (JSX + Fast Refresh) and Tailwind. Tailwind has no config file of its
// own here: its design tokens live in global.css.
export default defineConfig({
  plugins: [react(), tailwindcss()],
});
