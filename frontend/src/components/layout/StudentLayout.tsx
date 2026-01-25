import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LayoutDashboard, Award, LogOut, School, GraduationCap } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function StudentLayout() {
    const { logout, user } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const navItems = [
        { label: 'Exams', icon: LayoutDashboard, path: '/student/dashboard' },
        { label: 'Results', icon: Award, path: '/student/results' },
    ];

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
            {/* Sidebar / Bottom Nav (Mobile/Desktop) */}
            <aside className="bg-slate-900 md:w-72 md:h-screen sticky top-0 z-50 md:fixed shadow-2xl flex flex-col transition-all overflow-hidden">
                <div className="flex items-center justify-between p-6 md:p-8 border-b border-slate-800">
                    <div className="flex flex-col">
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-premium rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                                <School size={24} />
                            </div>
                            <div>
                                <span className="font-black text-xl text-white tracking-tight block">Portal</span>
                                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest leading-none">Student Hub</span>
                            </div>
                        </div>
                    </div>

                    <button onClick={handleLogout} className="md:hidden p-2 text-slate-400 hover:text-white bg-slate-800 rounded-xl">
                        <LogOut size={20} />
                    </button>
                </div>

                <nav className="flex md:flex-col p-4 md:p-6 space-x-4 md:space-x-0 md:space-y-2 overflow-x-auto md:overflow-visible no-scrollbar">
                    <p className="hidden md:block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 ml-2">Main Navigation</p>
                    {navItems.map((item) => (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={cn(
                                "flex items-center space-x-3 px-6 py-3.5 rounded-xl text-sm font-bold transition-all duration-200 group shrink-0",
                                location.pathname === item.path
                                    ? "bg-premium text-white shadow-lg shadow-indigo-500/20"
                                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                            )}
                        >
                            <item.icon size={20} className={cn("transition-transform group-hover:scale-110", location.pathname === item.path ? "text-white" : "text-slate-500")} />
                            <span>{item.label}</span>
                        </Link>
                    ))}

                    <div className="hidden md:block mt-auto pt-6 border-t border-slate-800 font-bold">
                        <div className="flex items-center space-x-4 px-2 py-4 mb-4 bg-slate-800/50 rounded-2xl border border-slate-700/50">
                            <div className="w-10 h-10 bg-gradient-to-tr from-indigo-500 to-primary-600 rounded-xl flex items-center justify-center text-white font-black shadow-inner">
                                {user?.name?.charAt(0) || 'S'}
                            </div>
                            <div className="overflow-hidden">
                                <p className="font-bold text-white truncate text-sm leading-tight">{user?.name}</p>
                                <p className="text-[10px] text-indigo-400 font-black uppercase tracking-wider mt-1">Student</p>
                            </div>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center justify-center space-x-3 px-4 py-3 text-sm font-black text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-xl transition-all border border-transparent hover:border-red-500/20 active:scale-95"
                        >
                            <LogOut size={20} />
                            <span>Sign Out</span>
                        </button>
                    </div>
                </nav>
            </aside>

            {/* Main Content */}
            <main className="flex-1 md:ml-72 p-4 md:p-8">
                <Outlet />
            </main>
        </div>
    );
}
