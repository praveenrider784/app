import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import PwaInstallPrompt from './components/common/PwaInstallPrompt';
import Login from './pages/auth/Login';
import Signup from './pages/auth/Signup';
import PaymentPending from './pages/auth/PaymentPending';
import ProtectedRoute from './components/layout/ProtectedRoute';

import TeacherLayout from './components/layout/TeacherLayout';
import TeacherDashboard from './pages/teacher/Dashboard';
import CreateExam from './pages/teacher/CreateExam';
import DetailedResults from './pages/teacher/Results';
import UploadQuestions from './pages/teacher/UploadQuestions';

// Placeholders for dashboards (to be implemented next)
import StudentLayout from './components/layout/StudentLayout';
import StudentDashboard from './pages/student/Dashboard';
import ExamInterface from './pages/student/ExamInterface';
import StudentResults from './pages/student/Results';

const AdminDashboard = () => <div>Admin Dashboard</div>;

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <PwaInstallPrompt />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/payment-pending" element={<PaymentPending />} />

          {/* Admin Routes */}
          <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
          </Route>

          {/* Teacher Routes */}
          <Route element={<ProtectedRoute allowedRoles={['teacher', 'admin']} />}>
            <Route path="/teacher" element={<TeacherLayout />}>
              <Route path="dashboard" element={<TeacherDashboard />} />
              <Route path="results" element={<DetailedResults />} />
              <Route path="create-exam" element={<CreateExam />} />
              <Route path="upload-questions" element={<UploadQuestions />} />
            </Route>
          </Route>

          {/* Student Routes */}
          <Route element={<ProtectedRoute allowedRoles={['student']} />}>
            <Route path="/student" element={<StudentLayout />}>
              <Route path="dashboard" element={<StudentDashboard />} />
              <Route path="results" element={<StudentResults />} />
            </Route>
            {/* Full Screen Exam Mode (Outside Layout) */}
            <Route path="/student/exam/:examId" element={<ExamInterface />} />
          </Route>

          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
