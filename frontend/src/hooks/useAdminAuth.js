import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { admin } from '../api';

export default function useAdminAuth() {
  const navigate = useNavigate();

  const login = useCallback(async (username, password) => {
    await admin.login(username, password);
    navigate('/admin');
  }, [navigate]);

  const logout = useCallback(() => {
    admin.logout();
    navigate('/admin/login');
  }, [navigate]);

  const isAuthenticated = admin.isAuthenticated();

  return { login, logout, isAuthenticated };
}
