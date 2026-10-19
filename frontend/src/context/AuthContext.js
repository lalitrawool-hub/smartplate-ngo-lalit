import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config/api';

const AuthContext = createContext(null);
const API = API_BASE_URL;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('smartplate_token'));
  const [loading, setLoading] = useState(true);

  // 🔑 prevents auth/me from running immediately after login
  const justLoggedInRef = useRef(false);

  const fetchUser = useCallback(async () => {
    if (!token || justLoggedInRef.current) {
      setLoading(false);
      return;
    }

    try {
      const response = await axios.get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(response.data);
    } catch (error) {
      console.error('Auth error:', error);
      localStorage.removeItem('smartplate_token');
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  // ✅ GOOGLE LOGIN
  const login = async (credential) => {
    try {
      const response = await axios.post(`${API}/auth/google`, { credential });

      const { token: newToken, user: userData } = response.data;

      justLoggedInRef.current = true;

      localStorage.setItem('smartplate_token', newToken);
      setToken(newToken);
      setUser(userData);

      // allow auth/me later (after navigation)
      setTimeout(() => {
        justLoggedInRef.current = false;
      }, 500);

      return response.data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const verifyPhone = async (phone, otp) => {
    const response = await axios.post(
      `${API}/auth/verify-phone`,
      { phone, otp },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    setUser(prev => ({ ...prev, phone, phone_verified: true }));
    return response.data;
  };

  const selectRole = async (role) => {
    const response = await axios.post(
      `${API}/auth/select-role`,
      { role },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    localStorage.setItem('smartplate_token', response.data.token);
    setToken(response.data.token);
    setUser(response.data.user);

    return response.data;
  };

  const logout = () => {
    localStorage.removeItem('smartplate_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      login,
      logout,
      verifyPhone,
      selectRole,
      isAuthenticated: !!user,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
