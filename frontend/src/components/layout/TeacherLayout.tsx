import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LayoutDashboard, FileText, Upload, LogOut, School } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function TeacherLayout() {
    const { logout, user } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const navItems = [
        { label: 'Dashboard', icon: LayoutDashboard, path: '/teacher/dashboard' },
        { label: 'Create Exam', icon: FileText, path: '/teacher/create-exam' },
        { label: 'Upload Questions', icon: Upload, path: '/teacher/upload-questions' },
    ];

    return (
        <div className="min-h-screen bg-slate-50 flex">
            {/* Sidebar */}
            <aside className="w-72 bg-slate-900 fixed h-full hidden md:flex flex-col shadow-2xl z-50">
                <div className="p-8 border-b border-slate-800 flex flex-col">
                    <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-premium rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                            <School size={24} />
                        </div>
                        <div>
                            <span className="font-black text-xl text-white tracking-tight block">Portal</span>
                            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest leading-none">Instructor Suite</span>
                        </div>
                    </div>
                </div>

                <nav className="flex-1 p-6 space-y-2">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 ml-2">Menu</p>
                    {navItems.map((item) => (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={cn(
                                "flex items-center space-x-3 px-4 py-3.5 rounded-xl text-sm font-bold transition-all duration-200 group",
                                location.pathname === item.path
                                    ? "bg-premium text-white shadow-lg shadow-indigo-500/20"
                                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                            )}
                        >
                            <item.icon size={20} className={cn("transition-transform group-hover:scale-110", location.pathname === item.path ? "text-white" : "text-slate-500")} />
                            <span>{item.label}</span>
                        </Link>
                    ))}
                </nav>

                <div className="p-6 border-t border-slate-800 bg-slate-900/50 backdrop-blur-md">
                    <div className="flex items-center space-x-4 px-2 py-4 mb-4 bg-slate-800/50 rounded-2xl border border-slate-700/50">
                        <div className="w-10 h-10 bg-gradient-to-tr from-slate-700 to-slate-600 rounded-xl flex items-center justify-center text-white font-black shadow-inner">
                            {user?.name?.charAt(0) || 'T'}
                        </div>
                        <div className="overflow-hidden">
                            <p className="font-bold text-white truncate text-sm leading-tight">{user?.name}</p>
                            <p className="text-[10px] text-indigo-400 font-black uppercase tracking-wider mt-1">{user?.role}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center space-x-3 px-4 py-3 text-sm font-black text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-xl transition-all border border-transparent hover:border-red-500/20 active:scale-95"
                    >
                        <LogOut size={18} />
                        <span>Sign Out</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 md:ml-72 p-8">
                <Outlet />
            </main>
        </div>
    );
}
