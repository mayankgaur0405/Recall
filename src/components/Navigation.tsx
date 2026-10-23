'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Library, Search, LogOut, Home, Settings } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'

export default function Navigation() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
    })
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
    })
    
    return () => subscription.unsubscribe()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (pathname === '/login') return null;

  return (
    <nav className="fixed top-0 left-0 right-0 bg-stone-50/80 backdrop-blur-md z-50 border-b border-stone-200">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="font-semibold text-lg tracking-tight">
          Post Vault
        </Link>
        
        {user && (
          <div className="flex items-center gap-6 text-sm font-medium text-stone-600">
            <Link 
              href="/" 
              className={`flex items-center gap-2 hover:text-stone-900 transition-colors ${pathname === '/' ? 'text-stone-900' : ''}`}
            >
              <Home size={18} />
              <span className="hidden sm:inline">Home</span>
            </Link>
            <Link 
              href="/search" 
              className={`flex items-center gap-2 hover:text-stone-900 transition-colors ${pathname === '/search' ? 'text-stone-900' : ''}`}
            >
              <Search size={18} />
              <span className="hidden sm:inline">Search</span>
            </Link>
            <Link 
              href="/library" 
              className={`flex items-center gap-2 hover:text-stone-900 transition-colors ${pathname === '/library' ? 'text-stone-900' : ''}`}
            >
              <Library size={18} />
              <span className="hidden sm:inline">Library</span>
            </Link>
            
            <div className="w-px h-4 bg-stone-300 ml-2" />
            
            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 hover:text-stone-900 transition-colors ml-2"
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          </div>
        )}
      </div>
    </nav>
  )
}
