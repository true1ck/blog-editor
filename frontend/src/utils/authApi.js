import axios from 'axios'

// Auth service API (separate from blog editor API)
const AUTH_API_URL = import.meta.env.VITE_AUTH_API_URL || 'http://localhost:3000'

const authApi = axios.create({
  baseURL: AUTH_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

export default authApi
