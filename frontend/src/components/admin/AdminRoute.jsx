import { Navigate } from 'react-router-dom';
import { admin } from '../../api';

export default function AdminRoute({ children }) {
  if (!admin.isAuthenticated()) {
    return <Navigate to="/admin/login" replace />;
  }
  return children;
}
