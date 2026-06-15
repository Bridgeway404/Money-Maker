'use client'

import { ReactNode, useEffect } from 'react'
import { X } from 'lucide-react'
import Button from './Button'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
}

export default function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={`relative z-10 w-full ${sizeClasses[size]} bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl`}
      >
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
            <h2 className="text-lg font-semibold text-zinc-100">{title}</h2>
            <button
              onClick={onClose}
              className="text-zinc-400 hover:text-zinc-100 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}
