import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Toaster } from "./components/ui/sonner";

// Pages
import { LandingPage } from "./pages/LandingPage";
import { AuthPage } from "./pages/AuthPage";
import { NGODashboard } from "./pages/NGODashboard";
import { DonorDashboard } from "./pages/DonorDashboard";
import { VolunteerDashboard } from "./pages/VolunteerDashboard";
import { AdminDashboard } from "./pages/AdminDashboard";
import { PublicFoodRequestPage } from "./pages/PublicFoodRequestPage";

// Protected Route Component
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    // Redirect to appropriate dashboard based on role
    if (user?.role) {
      return <Navigate to={`/${user.role}`} replace />;
    }
    return <Navigate to="/auth" replace />;
  }

  return children;
};

// Auth Route - redirects if already logged in with role
const AuthRoute = ({ children }) => {
  const { user, loading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (isAuthenticated && user?.role && user?.phone_verified) {
    const returnTo = location.state?.returnTo;
    const safeReturnTo = user.role === 'donor'
      && typeof returnTo === 'string'
      && /^\/donor\?request_id=[\w-]+$/.test(returnTo)
      ? returnTo
      : `/${user.role}`;
    return <Navigate to={safeReturnTo} replace />;
  }

  return children;
};

function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/auth" element={
        <AuthRoute>
          <AuthPage />
        </AuthRoute>
      } />
      <Route path="/auth/google" element={
        <AuthRoute>
          <AuthPage />
        </AuthRoute>
      } />
      <Route path="/requests/:requestId" element={<PublicFoodRequestPage />} />
      
      {/* NGO Dashboard */}
      <Route path="/ngo" element={
        <ProtectedRoute allowedRoles={['ngo']}>
          <NGODashboard />
        </ProtectedRoute>
      } />
      
      {/* Donor Dashboard */}
      <Route path="/donor" element={
        <ProtectedRoute allowedRoles={['donor']}>
          <DonorDashboard />
        </ProtectedRoute>
      } />
      
      {/* Volunteer Dashboard */}
      <Route path="/volunteer" element={
        <ProtectedRoute allowedRoles={['volunteer']}>
          <VolunteerDashboard />
        </ProtectedRoute>
      } />
      
      {/* Admin Dashboard */}
      <Route path="/admin" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <AdminDashboard />
        </ProtectedRoute>
      } />
      
      {/* Catch all - redirect to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </div>
  );
}

export default App;
