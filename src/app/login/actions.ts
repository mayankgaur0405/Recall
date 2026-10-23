'use strict'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

function fail(message: string): never {
  redirect(`/login?message=${encodeURIComponent(message)}`)
}

function isNextControlFlow(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const digest = 'digest' in error ? String((error as { digest?: string }).digest) : ''
  const message = error instanceof Error ? error.message : ''
  return (
    digest.startsWith('NEXT_REDIRECT') ||
    digest.startsWith('NEXT_NOT_FOUND') ||
    message === 'NEXT_REDIRECT' ||
    message === 'NEXT_NOT_FOUND'
  )
}

function describeAuthError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  const lowered = message.toLowerCase()
  if (
    lowered.includes('fetch failed') ||
    lowered.includes('enotfound') ||
    lowered.includes('failed to fetch')
  ) {
    return 'Cannot reach Supabase. The URL in .env.local does not resolve. Create a project at supabase.com, paste NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY into .env.local, run supabase_setup.sql, then restart npm run dev.'
  }
  return message
}

export async function login(formData: FormData) {
  'use server'
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  let authError: unknown = null
  try {
    const supabase = await createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    authError = error
  } catch (error) {
    if (isNextControlFlow(error)) throw error
    console.error('Login error:', error)
    fail(describeAuthError(error))
  }

  if (authError) {
    const message = authError instanceof Error ? authError.message : String(authError)
    console.error('Login error:', message)
    fail(describeAuthError(authError))
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function signup(formData: FormData) {
  'use server'
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  let needsEmailConfirm = false
  let authError: unknown = null
  try {
    const supabase = await createClient()
    const { error, data } = await supabase.auth.signUp({
      email,
      password,
    })
    authError = error
    needsEmailConfirm = Boolean(data?.user && data?.session === null)
  } catch (error) {
    if (isNextControlFlow(error)) throw error
    console.error('Signup error:', error)
    fail(describeAuthError(error))
  }

  if (authError) {
    const message = authError instanceof Error ? authError.message : String(authError)
    console.error('Signup error:', message)
    fail(describeAuthError(authError))
  }

  if (needsEmailConfirm) {
    fail('Please check your email to confirm your account.')
  }

  revalidatePath('/', 'layout')
  redirect('/')
}
