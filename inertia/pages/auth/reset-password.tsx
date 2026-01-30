import { useState } from 'react'
import { Head, useForm } from '@inertiajs/react'

interface ResetPasswordProps {
  token: string
}

export default function ResetPassword({ token }: ResetPasswordProps) {
  const [resetComplete, setResetComplete] = useState(false)
  
  const { data, setData, post, processing, errors } = useForm({
    token,
    password: '',
    passwordConfirmation: ''
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    post('/reset-password', {
      onSuccess: () => {
        setResetComplete(true)
      }
    })
  }

  return (
    <>
      <Head title="Reset Password" />
      
      <div className="min-h-screen flex items-center justify-center bg-sand-1">
        <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow-md">
          <div className="text-center">
            <h1 className="text-3xl font-extrabold text-gray-900">Reset your password</h1>
            <p className="mt-2 text-sm text-gray-600">
              Create a new password for your account
            </p>
          </div>
          
          {resetComplete ? (
            <div className="bg-green-50 text-green-700 p-4 rounded-md">
              <p>Your password has been reset successfully.</p>
              <p className="mt-4">
                <a href="/login" className="font-medium text-primary hover:text-primary-dark">
                  Return to login
                </a>
              </p>
            </div>
          ) : (
            <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
              <input type="hidden" name="token" value={token} />
              
              <div className="space-y-4">
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    New Password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={data.password}
                    onChange={e => setData('password', e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                  />
                  {errors.password && (
                    <p className="mt-1 text-sm text-red-500">{errors.password}</p>
                  )}
                </div>
                
                <div>
                  <label htmlFor="passwordConfirmation" className="block text-sm font-medium text-gray-700">
                    Confirm New Password
                  </label>
                  <input
                    id="passwordConfirmation"
                    name="passwordConfirmation"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={data.passwordConfirmation}
                    onChange={e => setData('passwordConfirmation', e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                  />
                  {errors.passwordConfirmation && (
                    <p className="mt-1 text-sm text-red-500">{errors.passwordConfirmation}</p>
                  )}
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={processing}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
                >
                  {processing ? 'Resetting password...' : 'Reset password'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  )
}