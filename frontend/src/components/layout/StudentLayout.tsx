import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LayoutDashboard, Award, LogOut, School } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function StudentLayout() {
    const { logout, user } = useAuth();
    const location = useLocation();

    const navItems = [
        { label: 'Exams', icon: LayoutDashboard, path: '/student/dashboard' },
        { label: 'Results', icon: Award, path: '/student/results' },
    ];

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
            {/* Sidebar / Bottom Nav (Mobile) */}
            <aside className="bg-white border-b md:border-b-0 md:border-r border-slate-200 md:w-64 md:h-screen sticky top-0 z-10 md:fixed">
                <div className="flex items-center justify-between p-4 md:p-6 border-b border-slate-100">
                    <div className="flex flex-col">
                        <div className="flex items-center space-x-2">
                            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
                                <School size={20} />
                            </div>
                            <span className="font-bold text-lg text-slate-800">ExamApp</span>
                        </div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2 ml-1">
                            Hii, {user?.name.split(' ')[0]} 👋
                        </p>
                    </div>

                    {/* Mobile User Menu / Logout could go here */}
                    <button onClick={logout} className="md:hidden text-slate-500">
                        <LogOut size={20} />
                    </button>
                </div>

                <nav className="flex md:flex-col overflow-x-auto md:overflow-visible p-2 md:p-4 space-x-2 md:space-x-0 md:space-y-1">
                    {navItems.map((item) => (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={cn(
                                "flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
                                location.pathname === item.path
                                    ? "bg-blue-50 text-blue-700"
                                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                            )}
                        >
                            <item.icon size={20} />
                            <span>{item.label}</span>
                        </Link>
                    ))}

                    <button
                        onClick={logout}
                        className="hidden md:flex items-center space-x-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors mt-auto"
                    >
                        <LogOut size={20} />
                        <span>Logout</span>
                    </button>
                </nav>
            </aside>

            {/* Main Content */}
            <main className="flex-1 md:ml-64 p-4 md:p-8">
                <Outlet />
            </main>
        </div>
    );
}
