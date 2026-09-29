'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Settings as SettingsIcon, Trash2, LogOut, User as UserIcon, Shield } from 'lucide-react'
import { User } from '@supabase/supabase-js'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
    })
  }, [])

  const handleDeleteAll = async () => {
    if (!confirm("WARNING: This will delete ALL your saved Reels permanently. Are you absolutely sure?")) return;

    setIsDeleting(true)
    try {
      const { error } = await supabase
        .from('reels')
        .delete()
        .eq('user_id', user?.id)
      
      if (error) throw error
      
      toast.success('All saved content deleted')
    } catch (error) {
      toast.error('Failed to delete content')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (!user) return null;

  return (
    <div className="w-full max-w-2xl mx-auto pt-8 pb-20">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 bg-stone-100 rounded-lg">
          <SettingsIcon size={24} className="text-stone-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-stone-500 text-sm">Manage your account and data.</p>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {/* Account Section */}
        <section className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-stone-100 bg-stone-50/50">
            <h2 className="font-semibold text-stone-900 flex items-center gap-2">
              <UserIcon size={18} className="text-stone-500" />
              Account
            </h2>
          </div>
          <div className="p-6">
            <div className="mb-4">
              <label className="block text-sm font-medium text-stone-500 mb-1">Email</label>
              <div className="text-stone-900">{user.email}</div>
            </div>
            <button 
              onClick={handleLogout}
              className="text-stone-600 font-medium hover:text-stone-900 transition-colors flex items-center gap-2 text-sm"
            >
              <LogOut size={16} />
              Log out of Recall
            </button>
          </div>
        </section>

        {/* Data Section */}
        <section className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-stone-100 bg-stone-50/50">
            <h2 className="font-semibold text-stone-900 flex items-center gap-2">
              <Shield size={18} className="text-stone-500" />
              Privacy & Data
            </h2>
          </div>
          <div className="p-6">
            <p className="text-sm text-stone-600 mb-6">
              Your saved content belongs to you. We do not expose private user data, and your saved content is never used to answer other users' questions.
            </p>
            
            <div className="pt-4 border-t border-stone-100">
              <h3 className="text-sm font-medium text-red-600 mb-2">Danger Zone</h3>
              <p className="text-sm text-stone-500 mb-4">
                Permanently delete all your saved items. This action cannot be undone.
              </p>
              <button 
                onClick={handleDeleteAll}
                disabled={isDeleting}
                className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <Trash2 size={16} />
                {isDeleting ? 'Deleting...' : 'Delete All Saved Content'}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
