'use client'
import AuthGuard from './AuthGuard'
import AppShell from './AppShell'
import { DataProvider } from './DataProvider'
export default function ProtectedLayout({children}:{children:React.ReactNode}){return <AuthGuard><DataProvider><AppShell>{children}</AppShell></DataProvider></AuthGuard>}
