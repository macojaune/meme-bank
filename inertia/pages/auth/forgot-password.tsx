import { useState } from 'react'
import { Head, useForm } from '@inertiajs/react'

export default function ForgotPassword() {
  const [emailSent, setEmailSent] = useState(false)
  
  const { data, setData, post, processing, errors } = useForm({
    email: ''
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    post('/forgot-password', {
      onSuccess: () => {
        setEmailSent(true)
      }
    })
  }

  return (
    <>
      <Head title="Forgot Password" />
      
      <div className="min-h-screen flex items-center justify-center bg-sand-1">
        <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow-md">
          <div className="text-center">
            <h1 className="text-3xl font-extrabold text-gray-900">Forgot your password?</h1>
            <p className="mt-2 text-sm text-gray-600">
              Enter your email address and we'll send you a link to reset your password.
            </p>
          </div>
          
          {emailSent ? (
            <div className="bg-green-50 text-green-700 p-4 rounded-md">
              <p>If your email is registered, you will receive a password reset link shortly.</p>
              <p className="mt-4">
                <a href="/login" className="font-medium text-primary hover:text-primary-dark">
                  Return to login
                </a>
              </p>
            </div>
          ) : (
            <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={data.email}
                  onChange={e => setData('email', e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-red-500">{errors.email}</p>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <a href="/login" className="font-medium text-primary hover:text-primary-dark">
                    Back to login
                  </a>
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={processing}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
                >
                  {processing ? 'Sending...' : 'Send reset link'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  )
}