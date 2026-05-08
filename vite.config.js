import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/caregiver-chinese-learning-v2/',
  plugins: [react()],
});
