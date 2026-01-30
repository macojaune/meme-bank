import { Head, Link, useForm } from '@inertiajs/react'

export default function Register() {
  const { data, setData, post, processing, errors, reset } = useForm({
    fullName: '',
    email: '',
    password: '',
    passwordConfirmation: '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation()

    post('/register', {
      onSuccess: () => {
        reset()
      },
      onError: (validationErrors) => {
        console.log('Validation errors:', validationErrors)
      },
      preserveScroll: true,
    })
  }

  return (
    <>
      <Head title="Create Account" />

      <div className="min-h-screen bg-bg flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="card-neo bg-white border-[3px] border-border shadow-neo p-6 sm:p-8">
            <div className="text-center mb-8">
              <div className="text-5xl mb-4">🎭</div>
              <h1 className="text-3xl sm:text-4xl font-black text-text uppercase tracking-tight">
                CREATE ACCOUNT
              </h1>
              <p className="mt-2 text-text font-medium">Join the meme revolution!</p>
            </div>

            {(errors as Record<string, string>).general && (
              <div className="alert-neo-secondary border-[3px] border-secondary-300 bg-secondary-50 p-4 mb-6 shadow-neo-sm">
                <div className="flex items-center gap-2 font-bold text-secondary-800 uppercase text-sm">
                  <span>⚠️</span>
                  {(errors as Record<string, string>).general}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label
                  htmlFor="fullName"
                  className="block text-sm font-bold text-text uppercase mb-2 tracking-wide"
                >
                  Full Name 📝
                </label>
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  autoComplete="name"
                  value={data.fullName}
                  onChange={(e) => setData('fullName', e.target.value)}
                  className={`input-neo border-[3px] font-bold text-text placeholder:font-semibold ${
                    errors.fullName ? 'input-neo-error border-[3px]' : ''
                  }`}
                  placeholder="Enter your name"
                />
                {errors.fullName && (
                  <p className="mt-2 text-sm font-bold text-secondary-500 uppercase">
                    ⚠️ {errors.fullName}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-bold text-text uppercase mb-2 tracking-wide"
                >
                  Email Address 📧
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={data.email}
                  onChange={(e) => setData('email', e.target.value)}
                  className={`input-neo border-[3px] font-bold text-text placeholder:font-semibold ${
                    errors.email ? 'input-neo-error border-[3px]' : ''
                  }`}
                  placeholder="you@example.com"
                />
                {errors.email && (
                  <p className="mt-2 text-sm font-bold text-secondary-500 uppercase">
                    ⚠️ {errors.email}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-bold text-text uppercase mb-2 tracking-wide"
                >
                  Password 🔐
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={data.password}
                  onChange={(e) => setData('password', e.target.value)}
                  className={`input-neo border-[3px] font-bold text-text placeholder:font-semibold ${
                    errors.password ? 'input-neo-error border-[3px]' : ''
                  }`}
                  placeholder="Create a strong password"
                />
                {errors.password && (
                  <p className="mt-2 text-sm font-bold text-secondary-500 uppercase">
                    ⚠️ {errors.password}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="passwordConfirmation"
                  className="block text-sm font-bold text-text uppercase mb-2 tracking-wide"
                >
                  Confirm Password 🔒
                </label>
                <input
                  id="passwordConfirmation"
                  name="passwordConfirmation"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={data.passwordConfirmation}
                  onChange={(e) => setData('passwordConfirmation', e.target.value)}
                  className={`input-neo border-[3px] font-bold text-text placeholder:font-semibold ${
                    errors.passwordConfirmation ? 'input-neo-error border-[3px]' : ''
                  }`}
                  placeholder="Confirm your password"
                />
                {errors.passwordConfirmation && (
                  <p className="mt-2 text-sm font-bold text-secondary-500 uppercase">
                    ⚠️ {errors.passwordConfirmation}
                  </p>
                )}
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={processing}
                  className="btn-neo-primary w-full text-lg uppercase font-black tracking-wide border-[3px] disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {processing ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="loader-neo w-5 h-5 border-[3px]" />
                      Creating...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      🚀 CREATE ACCOUNT
                    </span>
                  )}
                </button>
              </div>
            </form>

            <div className="mt-8 pt-6 border-t-[3px] border-border">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <span className="text-sm font-bold text-text uppercase">Already a member? 👋</span>
                <Link
                  href="/login"
                  className="btn-neo-secondary px-6 py-2 text-sm uppercase font-bold border-[3px]"
                >
                  SIGN IN →
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-6 text-center">
            <Link
              href="/"
              className="text-sm font-bold text-text-muted hover:text-text uppercase transition-colors"
            >
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
