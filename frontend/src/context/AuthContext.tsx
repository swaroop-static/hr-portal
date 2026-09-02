import React, { createContext, useContext, useState, useEffect } from 'react';
import { loginUser } from '../api';
import { disconnectSocket } from '../socket';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'MANAGER' | 'HR' | 'INTERVIEWER' | 'CANDIDATE';
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>(null!);

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('hr_portal_token');
    const stored = localStorage.getItem('hr_portal_user');
    if (token && stored && !isTokenExpired(token)) {
      setUser(JSON.parse(stored));
    } else if (token || stored) {
      localStorage.removeItem('hr_portal_token');
      localStorage.removeItem('hr_portal_user');
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const data = await loginUser(email, password);
    localStorage.setItem('hr_portal_token', data.token);
    localStorage.setItem('hr_portal_user', JSON.stringify(data.user));
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem('hr_portal_token');
    localStorage.removeItem('hr_portal_user');
    disconnectSocket();
    setUser(null);
    window.location.href = '/';
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
