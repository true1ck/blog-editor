import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'

export default function Login() {
  const [phoneNumber, setPhoneNumber] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState('phone') // 'phone' or 'otp'
  const [loading, setLoading] = useState(false)
  const { requestOtp, verifyOtp } = useAuth()
  const navigate = useNavigate()

  const handleRequestOtp = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      await requestOtp(phoneNumber)
      toast.success('OTP sent to your phone!')
      setStep('otp')
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to send OTP')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      await verifyOtp(phoneNumber, otp)
      toast.success('Logged in successfully!')
      navigate('/dashboard')
    } catch (error) {
      toast.error(error.response?.data?.error || 'Invalid OTP')
    } finally {
      setLoading(false)
    }
  }

  const normalizePhone = (phone) => {
    const p = phone.trim().replace(/\s+/g, '')
    if (p.startsWith('+')) return p
    if (p.length === 10) return '+91' + p
    return p
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {step === 'phone' ? 'Sign in to your account' : 'Enter OTP'}
          </h2>
        </div>

        {step === 'phone' ? (
          <form className="mt-8 space-y-6" onSubmit={handleRequestOtp}>
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                Phone Number
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                required
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="+919876543210 or 9876543210"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(normalizePhone(e.target.value))}
              />
              <p className="mt-2 text-sm text-gray-500">
                We'll send you an OTP to verify your phone number
              </p>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {loading ? 'Sending OTP...' : 'Send OTP'}
              </button>
            </div>
          </form>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleVerifyOtp}>
            <div>
              <label htmlFor="otp" className="block text-sm font-medium text-gray-700">
                Enter OTP
              </label>
              <input
                id="otp"
                name="otp"
                type="text"
                maxLength="4"
                required
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm text-center text-2xl tracking-widest"
                placeholder="0000"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              />
              <p className="mt-2 text-sm text-gray-500">
                Enter the 4-digit OTP sent to {phoneNumber}
              </p>
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-3 sm:gap-4">
              <button
                type="button"
                onClick={() => {
                  setStep('phone')
                  setOtp('')
                }}
                className="flex-1 w-full sm:w-auto py-2 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Change Number
              </button>
              <button
                type="submit"
                disabled={loading || otp.length !== 4}
                className="flex-1 w-full sm:w-auto py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {loading ? 'Verifying...' : 'Verify OTP'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
