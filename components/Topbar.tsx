'use client'
import React, { useState } from 'react'
import { RefreshCw, CheckCircle2, AlertTriangle, WifiOff } from 'lucide-react'
import { useData } from '@/components/DataProvider'

export default function Topbar({
  title,
  subtitle,
  actions
}: {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}) {
  const { syncStatus, syncNow, lastSyncedAt } = useData()
  const [isRotating, setIsRotating] = useState(false)

  const handleManualSync = async () => {
    setIsRotating(true)
    await syncNow()
    setTimeout(() => setIsRotating(false), 600)
  }

  const getSyncIcon = () => {
    if (isRotating || syncStatus === 'syncing') {
      return <RefreshCw size={13} className="spin-anim" />
    }
    if (syncStatus === 'synced') {
      return <CheckCircle2 size={13} color="#10b981" />
    }
    if (syncStatus === 'error') {
      return <AlertTriangle size={13} color="#f59e0b" />
    }
    return <WifiOff size={13} color="#64748b" />
  }

  const getSyncLabel = () => {
    if (isRotating || syncStatus === 'syncing') return 'Syncing...'
    if (syncStatus === 'synced') return 'Cloud Synced'
    if (syncStatus === 'error') return 'Sync Local'
    return 'Offline'
  }

  return (
    <div className="topbar">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <div className="sub">{subtitle}</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button
          onClick={handleManualSync}
          type="button"
          title={
            syncStatus === 'synced'
              ? `Synced with Database (${lastSyncedAt ? new Date(lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'just now'}) - Click to re-sync`
              : syncStatus === 'syncing'
              ? 'Syncing with Supabase...'
              : 'Local / Offline mode - Click to sync with Cloud'
          }
          className="btn btn-ghost"
          style={{
            padding: '6px 12px',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            borderRadius: '20px',
            cursor: 'pointer',
            background: syncStatus === 'synced' ? '#f0fdf4' : syncStatus === 'error' ? '#fffbeb' : '#f8fafc',
            color: syncStatus === 'synced' ? '#15803d' : syncStatus === 'error' ? '#b45309' : '#64748b',
            borderColor: syncStatus === 'synced' ? '#bbf7d0' : syncStatus === 'error' ? '#fde68a' : '#e2e8f0'
          }}
        >
          {getSyncIcon()}
          <span style={{ fontWeight: 600 }}>{getSyncLabel()}</span>
        </button>
        {actions}
      </div>
    </div>
  )
}
