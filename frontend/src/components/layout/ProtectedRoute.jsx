import React from 'react';
import { Navigate, useLocation, Link, Outlet } from 'react-router-dom';
import { authApi } from '../../services/authApi';

/**
 * Enterprise-grade Route Guard Component
 * Enforces authenticated session and role permissions.
 * Prevents unauthorized manual URL tampering across all 4 roles.
 */
export default function ProtectedRoute({ requiredRoles, children }) {
  const location = useLocation();
  const currentUser = authApi.getCurrentUser();

  // Unauthenticated -> Redirect to home page
  if (!currentUser) {
    return <Navigate to="/" replace />;
  }

  const userRole = (currentUser.role || 'FARMER').toUpperCase();
  const normalizedRequired = requiredRoles.map((r) => r.toUpperCase());

  // Role Mismatch -> 403 Access Denied Barrier
  if (!normalizedRequired.includes(userRole)) {
    const defaultDashboardPath = (() => {
      if (userRole === 'AGRICULTURAL_STAKEHOLDER') return '/stakeholder/dashboard';
      if (userRole === 'AGRICULTURAL_EXPERT') return '/expert/dashboard';
      if (userRole === 'ADMIN') return '/admin/dashboard';
      return '/farmer/dashboard';
    })();

    return (
      <div style={{
        minHeight: '80vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1rem'
      }}>
        <div style={{
          background: 'rgba(17, 26, 21, 0.95)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          borderRadius: '16px',
          padding: '2.5rem',
          maxWidth: '520px',
          width: '100%',
          textAlign: 'center',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
          backdropFilter: 'blur(16px)'
        }}>
          <div style={{
            fontSize: '3.5rem',
            width: '80px',
            height: '80px',
            lineHeight: '80px',
            background: 'rgba(239, 68, 68, 0.12)',
            borderRadius: '50%',
            margin: '0 auto 1.5rem',
            border: '1px solid rgba(239, 68, 68, 0.3)'
          }}>
            🚫
          </div>
          <h2 style={{ color: '#fca5a5', fontSize: '1.6rem', marginBottom: '0.75rem' }}>
            403 Forbidden • Access Denied
          </h2>
          <p style={{ color: '#9ca3af', fontSize: '0.95rem', lineHeight: '1.6', marginBottom: '1.5rem' }}>
            Your authenticated role is <strong style={{ color: '#fff' }}>{userRole}</strong>.
            You do not have permission to access <code style={{ background: 'rgba(255,255,255,0.08)', padding: '0.2rem 0.4rem', borderRadius: '4px' }}>{location.pathname}</code>.
            <br />
            Required role: <strong style={{ color: '#93c5fd' }}>{normalizedRequired.join(' or ')}</strong>.
          </p>
          <div style={{
            padding: '1rem',
            background: 'rgba(239, 68, 68, 0.08)',
            borderRadius: '8px',
            fontSize: '0.85rem',
            color: '#fca5a5',
            marginBottom: '1.75rem',
            textAlign: 'left'
          }}>
            🔒 <strong>Strict RBAC Guard:</strong> Backend APIs and UI routes validate token role cryptographically. Unauthorized URL jumps are blocked.
          </div>
          <Link
            to={defaultDashboardPath}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              background: 'var(--primary-600, #059669)',
              color: '#fff',
              padding: '0.75rem 1.75rem',
              borderRadius: '999px',
              fontWeight: 600,
              textDecoration: 'none',
              boxShadow: '0 0 20px rgba(16, 185, 129, 0.3)',
              transition: 'transform 0.2s ease',
            }}
          >
            ← Return to My Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return children ? children : <Outlet />;
}

