import { login, signup } from './actions'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>
}) {
  const { message } = await searchParams;

  return (
    <div className="flex-1 flex flex-col items-center justify-center -mt-16">
      <div className="w-full max-w-sm p-8 bg-white border border-stone-200 rounded-2xl shadow-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold mb-2">Recall</h1>
          <p className="text-stone-500 text-sm">Your memory for the internet.</p>
        </div>
        
        {message && (
          <div className="mb-6 p-3 bg-stone-100 text-stone-800 text-sm rounded-lg border border-stone-200">
            {message}
          </div>
        )}
        
        <form className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="email" className="text-sm font-medium text-stone-700">Email</label>
            <input 
              id="email" 
              name="email" 
              type="email" 
              required 
              className="px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900 focus:border-transparent transition-all"
              placeholder="you@example.com"
            />
          </div>
          
          <div className="flex flex-col gap-1">
            <label htmlFor="password" className="text-sm font-medium text-stone-700">Password</label>
            <input 
              id="password" 
              name="password" 
              type="password" 
              required 
              className="px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900 focus:border-transparent transition-all"
              placeholder="••••••••"
            />
          </div>
          
          <div className="flex flex-col gap-3 mt-4">
            <button 
              formAction={login} 
              className="bg-stone-900 text-white rounded-lg py-2.5 font-medium hover:bg-stone-800 transition-colors"
            >
              Log in
            </button>
            <button 
              formAction={signup} 
              className="bg-stone-100 text-stone-900 rounded-lg py-2.5 font-medium hover:bg-stone-200 transition-colors"
            >
              Sign up
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
