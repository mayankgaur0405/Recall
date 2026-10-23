import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from 'react-hot-toast'
import './globals.css'
import Navigation from '@/components/Navigation'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Post Vault - Your memory for the internet',
  description: 'Save it. Understand it. Find it later.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} bg-stone-50 text-stone-900 min-h-screen antialiased flex flex-col`} suppressHydrationWarning>
        <Navigation />
        <main className="flex-1 flex flex-col pt-16 max-w-5xl w-full mx-auto px-4">
          {children}
        </main>
        <Toaster position="bottom-center" />
      </body>
    </html>
  )
}
