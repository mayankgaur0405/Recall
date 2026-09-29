'use strict'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export async function login(formData: FormData) {
  'use server'
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    console.error("Login error:", error.message)
    redirect(`/login?message=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function signup(formData: FormData) {
  'use server'
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const supabase = await createClient()

  const { error, data } = await supabase.auth.signUp({
    email,
    password,
  })

  if (error) {
    console.error("Signup error:", error.message)
    redirect(`/login?message=${encodeURIComponent(error.message)}`)
  }

  // If email confirmations are enabled in Supabase, we might not get a session immediately.
  if (data?.user && data?.session === null) {
    redirect(`/login?message=${encodeURIComponent('Please check your email to confirm your account.')}`)
  }

  revalidatePath('/', 'layout')
  redirect('/')
}
