import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { GroupsPage } from './pages/GroupsPage';
import { GroupDetailsPage } from './pages/GroupDetailsPage';
import { LiveKitPortal } from './components/LiveKitPortal';
import './App.css';



function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* ... (inside App function Routes) */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/groups"
            element={
              <ProtectedRoute>
                <GroupsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/groups/:groupId"
            element={
              <ProtectedRoute>
                <GroupDetailsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <LiveKitPortal />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
