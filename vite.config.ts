import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

// `npm run dev:vr` (--mode vr) serve em HTTPS com certificado autoassinado: o WebXR do
// Meta Quest só liga em contexto seguro, e o IP da rede local não conta como seguro em HTTP.
const config = defineConfig(({ mode }) => ({
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    nitro(),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
    ...(mode === 'vr' ? [basicSsl()] : []),
  ],
}))

export default config
