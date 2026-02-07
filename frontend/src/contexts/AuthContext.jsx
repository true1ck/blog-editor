import { createContext, useContext, useState, useEffect } from 'react'
import authApi from '../utils/authApi'
import api from '../utils/api'

const AuthContext = createContext()

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const accessToken = localStorage.getItem('access_token')
    const savedUser = localStorage.getItem('user')
    
    if (accessToken && savedUser) {
      setUser(JSON.parse(savedUser))
      // Verify token is still valid by validating with auth service
      authApi.post('/auth/validate-token', { token: accessToken })
        .then((res) => {
          if (res.data.valid && res.data.payload) {
            const payload = res.data.payload
            const userData = {
              id: payload.sub,
              phone_number: payload.phone_number,
              role: payload.role || 'user',
              user_type: payload.user_type,
              is_guest: payload.is_guest || false,
            }
            setUser(userData)
            localStorage.setItem('user', JSON.stringify(userData))
          } else {
            // Token invalid, try refresh
            refreshToken()
          }
        })
        .catch(() => {
          // Try refresh token
          refreshToken()
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const refreshToken = async () => {
    const refreshToken = localStorage.getItem('refresh_token')
    if (!refreshToken) {
      logout()
      return
    }

    try {
      const res = await authApi.post('/auth/refresh', { refresh_token: refreshToken })
      const { access_token, refresh_token: newRefreshToken } = res.data
      localStorage.setItem('access_token', access_token)
      if (newRefreshToken) {
        localStorage.setItem('refresh_token', newRefreshToken)
      }
      // Update user from token payload
      const savedUser = localStorage.getItem('user')
      if (savedUser) {
        setUser(JSON.parse(savedUser))
      }
    } catch (error) {
      logout()
    }
  }

  const requestOtp = async (phoneNumber) => {
    const res = await authApi.post('/auth/request-otp', { phone_number: phoneNumber })
    return res.data
  }

  const verifyOtp = async (phoneNumber, otp) => {
    const res = await authApi.post('/auth/verify-otp', {
      phone_number: phoneNumber,
      code: otp, // Auth service expects 'code' not 'otp'
    })
    const { access_token, refresh_token, user: userData } = res.data
    localStorage.setItem('access_token', access_token)
    if (refresh_token) {
      localStorage.setItem('refresh_token', refresh_token)
    }
    localStorage.setItem('user', JSON.stringify(userData))
    setUser(userData)
    return res.data
  }

  const guestLogin = async (deviceId) => {
    const res = await authApi.post('/auth/guest-login', { device_id: deviceId })
    const { access_token, user: userData } = res.data
    localStorage.setItem('access_token', access_token)
    localStorage.setItem('user', JSON.stringify(userData))
    setUser(userData)
    return res.data
  }

  const logout = async () => {
    const refreshToken = localStorage.getItem('refresh_token')
    if (refreshToken) {
      try {
        await authApi.post('/auth/logout', { refresh_token: refreshToken })
      } catch (error) {
        console.error('Logout error:', error)
      }
    }
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      requestOtp, 
      verifyOtp, 
      guestLogin, 
      logout,
      refreshToken,
    }}>
      {children}
    </AuthContext.Provider>
  )
}
