import type { Metadata, Viewport } from 'next'
import './globals.css'
import PWARegister from '@/components/PWARegister'

const LOGO = 'https://zwilxcrbukksmwuqkfay.supabase.co/storage/v1/object/public/imagenes/logo.png'

export const metadata: Metadata = {
  title: 'Distrimas SC',
  description: 'Sistema de Gestión',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: LOGO,
    shortcut: LOGO,
    apple: LOGO,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Distrimas',
  },
}

export const viewport: Viewport = {
  themeColor: '#D72638',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        {children}
        <PWARegister />
      </body>
    </html>
  )
}
