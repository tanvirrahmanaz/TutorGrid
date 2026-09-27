import './globals.css'
import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'TutorGrid',
  description: 'Student schedule, lesson, attendance, task and payment manager',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg' }
}
export const viewport: Viewport = { themeColor: '#111827', width: 'device-width', initialScale: 1 }

export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="en"><body>{children}<script dangerouslySetInnerHTML={{__html:`if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}))}`}}/></body></html>
}
