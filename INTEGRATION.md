# Auth Service Integration

The blog editor is integrated with the existing auth service located at `G:\LivingAi\GITTEA_RPO\auth`.

## How It Works

### Backend Integration

The blog editor backend validates JWT tokens by calling the auth service's `/auth/validate-token` endpoint:

1. Client sends request with `Authorization: Bearer <token>` header
2. Blog editor backend middleware (`middleware/auth.js`) extracts the token
3. Middleware calls `POST /auth/validate-token` on the auth service
4. Auth service validates the token and returns user info
5. Blog editor backend sets `req.user` and continues processing

### Frontend Integration

The frontend uses the auth service directly for authentication:

1. **Login Flow:**
   - User enters phone number
   - Frontend calls `POST /auth/request-otp` on auth service
   - User enters OTP
   - Frontend calls `POST /auth/verify-otp` on auth service
   - Auth service returns `access_token` and `refresh_token`
   - Frontend stores tokens in localStorage

2. **API Requests:**
   - Frontend includes `Authorization: Bearer <access_token>` header
   - Blog editor backend validates token via auth service
   - If token expires, frontend automatically refreshes using `refresh_token`

## Configuration

### Backend (.env)
```env
AUTH_SERVICE_URL=http://localhost:3000
```

### Frontend (.env)
```env
VITE_AUTH_API_URL=http://localhost:3000
```

## Token Storage

- `access_token` - Stored in localStorage, used for API requests
- `refresh_token` - Stored in localStorage, used to refresh access token
- `user` - User object stored in localStorage

## Authentication Flow

```
┌─────────┐         ┌──────────────┐         ┌─────────────┐
│ Client  │────────▶│ Auth Service │────────▶│ Blog Editor  │
│         │         │              │         │   Backend    │
└─────────┘         └──────────────┘         └─────────────┘
     │                      │                        │
     │  1. Request OTP      │                        │
     │◀─────────────────────│                        │
     │                      │                        │
     │  2. Verify OTP       │                        │
     │─────────────────────▶│                        │
     │  3. Get Tokens       │                        │
     │◀─────────────────────│                        │
     │                      │                        │
     │  4. API Request      │                        │
     │──────────────────────────────────────────────▶│
     │                      │  5. Validate Token   │
     │                      │◀───────────────────────│
     │                      │  6. User Info         │
     │                      │───────────────────────▶│
     │  7. Response         │                        │
     │◀──────────────────────────────────────────────│
```

## Benefits

1. **Single Source of Truth:** All authentication handled by one service
2. **Consistent Security:** Same JWT validation across all services
3. **Token Rotation:** Auth service handles token refresh and rotation
4. **User Management:** Centralized user management in auth service
5. **Guest Support:** Auth service supports guest users

## Notes

- The blog editor backend does NOT handle user registration/login
- All authentication is delegated to the auth service
- The blog editor only validates tokens, not creates them
- Phone/OTP authentication is used (not email/password)
