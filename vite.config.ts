import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig, PluginOption, loadEnv } from "vite";

import sparkPlugin from "@github/spark/spark-vite-plugin";
import createIconImportProxy from "@github/spark/vitePhosphorIconProxyPlugin";
import { resolve } from 'path'

const projectRoot = process.env.PROJECT_ROOT || import.meta.dirname

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.VITE_SCM_BASE_URL || 'http://172.31.200.215:8080'
  let authHeader: string | undefined
  if (env.VITE_SCM_TOKEN) {
    authHeader = `Bearer ${env.VITE_SCM_TOKEN}`
  } else if (env.VITE_SCM_USERNAME && env.VITE_SCM_PASSWORD) {
    const b64 = Buffer.from(`${env.VITE_SCM_USERNAME}:${env.VITE_SCM_PASSWORD}`).toString('base64')
    authHeader = `Basic ${b64}`
  }

  return {
    plugins: [
      react(),
      tailwindcss(),
      // DO NOT REMOVE
      createIconImportProxy() as PluginOption,
      sparkPlugin() as PluginOption,
    ],
    resolve: {
      alias: {
        '@': resolve(projectRoot, 'src')
      }
    },
    server: {
      port: 4444,
      strictPort: true,
      host: true,
      proxy: {
        '/scm': {
          target,
          changeOrigin: true,
          ws: false,
          secure: false,
          headers: authHeader ? { Authorization: authHeader } : undefined,
        },
      },
    },
    preview: {
      port: 4444,
      strictPort: true,
      host: true,
    },
  }
});
