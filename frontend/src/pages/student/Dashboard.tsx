import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { Play, Clock, AlertCircle, Loader2, CheckCircle2, Calendar } from 'lucide-react';
import Pagination from '../../components/common/Pagination';
import { useAuth } from '../../context/AuthContext';

export default function StudentDashboard() {
    const { user } = useAuth();
    const [activeExams, setActiveExams] = useState<any[]>([]);
    const [historyExams, setHistoryExams] = useState<any[]>([]);
    const [historyPagination, setHistoryPagination] = useState<any>(null);
    const [historyPage, setHistoryPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const ACTIVE_LIMIT = 50;
    const HISTORY_LIMIT = 6;
    const upcomingRefreshRef = useRef<number | null>(null);

    const fetchActive = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const { data } = await api.get(`/student/exams?scope=active&page=1&limit=${ACTIVE_LIMIT}`);
            setActiveExams(data.exams);
        } catch (error) {
            console.error("Failed to fetch active exams");
        } finally {
            if (!silent) setLoading(false);
        }
    };

    const fetchHistory = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const { data } = await api.get(`/student/exams?scope=history&page=${historyPage}&limit=${HISTORY_LIMIT}`);
            setHistoryExams(data.exams);
            setHistoryPagination(data.pagination);
        } catch (error) {
            console.error("Failed to fetch history exams");
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => {
        fetchActive();
        fetchHistory();
    }, [historyPage]);

    useEffect(() => {
        const interval = setInterval(() => {
            fetchActive(true);
            fetchHistory(true);
        }, 30000);
        return () => clearInterval(interval);
    }, [historyPage]);

    useEffect(() => {
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                fetchActive(true);
                fetchHistory(true);
            }
        };
        window.addEventListener('visibilitychange', handleVisibility);
        return () => window.removeEventListener('visibilitychange', handleVisibility);
    }, [historyPage]);

    useEffect(() => {
        if (upcomingRefreshRef.current) {
            window.clearTimeout(upcomingRefreshRef.current);
            upcomingRefreshRef.current = null;
        }

        const now = Date.now();
        const upcomingTimes = activeExams
            .map((exam) => (exam.start_time ? new Date(exam.start_time).getTime() : null))
            .filter((t: number | null): t is number => typeof t === 'number' && t > now);

        if (upcomingTimes.length === 0) return;

        const nextStart = Math.min(...upcomingTimes);
        const delay = Math.max(0, nextStart - now + 1000);

        // If a start is near, refresh exactly when it begins.
        upcomingRefreshRef.current = window.setTimeout(() => {
            fetchActive(true);
        }, Math.min(delay, 30000));

        return () => {
            if (upcomingRefreshRef.current) {
                window.clearTimeout(upcomingRefreshRef.current);
                upcomingRefreshRef.current = null;
            }
        };
    }, [activeExams]);

    const activeExamsView = useMemo(() => {
        return activeExams.filter((exam) => exam.is_active === true && exam.is_expired !== true && exam.attempt_status !== 'completed');
    }, [activeExams]);

    const historyExamsView = useMemo(() => {
        return historyExams;
    }, [historyExams]);

    const handleStartExam = (examId: string) => {
        navigate(`/student/exam/${examId}`);
    };

    if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary-600" size={40} /></div>;

    return (
        <div className="space-y-8 pb-12">
            <header className="relative py-10 px-8 bg-slate-900 rounded-[32px] overflow-hidden shadow-2xl shadow-slate-200 group">
                <div className="absolute top-0 right-0 w-80 h-80 bg-primary-600/20 rounded-full -mr-24 -mt-24 blur-[80px] animate-pulse" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-600/10 rounded-full -ml-24 -mb-24 blur-[60px]" />

                <div className="relative z-10">
                    <h1 className="text-3xl font-black text-white leading-tight tracking-tight uppercase">
                        Hii, <br />
                        <span className="text-primary-400">
                            {user?.name || 'Student'}
                        </span>
                    </h1>
                    <p className="text-slate-400 mt-3 font-medium text-base max-w-lg">View your active exams and performance history.</p>
                </div>
            </header>

            <div className="px-1 space-y-10">
                {/* Active & Scheduled Section */}
                <section>
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                            <div className="w-1.5 h-6 bg-premium rounded-full" />
                            <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Active Sessions</h2>
                        </div>
                        <div className="h-px flex-1 bg-slate-100 mx-6" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {activeExamsView.map((exam) => {
                            const startTime = exam.start_time ? new Date(exam.start_time) : null;
                            const endTime = exam.end_time ? new Date(exam.end_time) : null;
                            const isUpcoming = exam.is_upcoming === true;
                            const canStart = !isUpcoming && exam.attempt_status !== 'completed';

                            return (
                                <div key={exam.id} className={`bg-white p-8 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/40 transition-all relative overflow-hidden group hover:scale-[1.02] ${isUpcoming ? 'opacity-80' : ''}`}>
                                    {isUpcoming ? (
                                        <div className="absolute top-0 right-0 bg-amber-500 text-white text-[10px] font-black px-4 py-1.5 rounded-bl-2xl uppercase tracking-[0.15em] flex items-center gap-2">
                                            <Clock size={12} />
                                            Scheduled
                                        </div>
                                    ) : (
                                        <div className="absolute top-0 right-0 bg-premium text-white text-[10px] font-black px-4 py-1.5 rounded-bl-2xl uppercase tracking-[0.15em] flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
                                            Live
                                        </div>
                                    )}

                                    <div className="mb-6">
                                        <h3 className="font-black text-xl text-slate-900 group-hover:text-primary-600 transition-colors uppercase tracking-tight">{exam.title}</h3>
                                        <div className="flex flex-col gap-2 mt-3">
                                            <p className="text-sm text-slate-500 font-bold flex items-center gap-2 bg-slate-50 w-fit px-3 py-1 rounded-full border border-slate-100">
                                                <Clock size={16} className="text-primary-500" /> {exam.duration_minutes} Minutes
                                            </p>
                                            {(exam.start_time || exam.end_time) && (
                                                <p className="text-[10px] text-slate-400 flex items-center gap-2 font-black uppercase tracking-widest mt-1 ml-1">
                                                    <Calendar size={14} className="text-indigo-400" />
                                                    {startTime ? startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Anytime'}
                                                    {' - '}
                                                    {endTime ? endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Active'}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => handleStartExam(exam.id)}
                                        disabled={!canStart}
                                        className={`w-full font-black py-4 rounded-2xl flex items-center justify-center space-x-3 transition-all ${canStart
                                            ? 'bg-premium hover:opacity-90 text-white shadow-xl shadow-primary-200 active:scale-95'
                                            : 'bg-slate-50 text-slate-400 cursor-not-allowed border border-slate-100'
                                            }`}
                                    >
                                        <Play size={20} fill={canStart ? "currentColor" : "none"} />
                                        <span>
                                            {isUpcoming ? `Starts at ${startTime?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` :
                                                'Start Assessment'}
                                        </span>
                                    </button>
                                </div>
                            );
                        })}

                        {activeExamsView.length === 0 && (
                            <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-400 bg-white rounded-[40px] border border-dashed border-slate-200">
                                <p className="text-sm font-bold uppercase tracking-widest opacity-50">No active or upcoming exams right now.</p>
                            </div>
                        )}
                    </div>
                </section>

                {/* Results & History Section */}
                <section>
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-8 bg-green-500 rounded-full" />
                            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Academic History</h2>
                        </div>
                        <div className="h-px flex-1 bg-slate-100 mx-8" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {historyExamsView.map((exam) => {
                            const isCompleted = exam.attempt_status === 'completed';
                            const endTime = exam.end_time ? new Date(exam.end_time) : null;
                            const hasScore = typeof exam.score === 'number' && typeof exam.total_questions === 'number';
                            const isInactive = !exam.is_active;
                            const label = isCompleted ? 'Scored' : 'Not Attempted';
                            const tagClass = isCompleted ? 'bg-green-100 text-green-700 border-green-200' : 'bg-slate-100 text-slate-700 border-slate-200';
                            const valueColor = isCompleted ? 'text-green-600' : 'text-slate-600';
                            return (
                                <div key={exam.id} className="bg-slate-50/50 p-8 rounded-[32px] border border-slate-200 transition-all relative overflow-hidden group hover:bg-white hover:shadow-2xl hover:shadow-slate-200">
                                    <div className={`absolute top-0 right-0 text-[10px] font-black px-4 py-1.5 rounded-bl-2xl uppercase tracking-[0.15em] flex items-center gap-2 border-b border-l ${tagClass}`}>
                                        {isCompleted ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                                        {isCompleted ? `Scored: ${exam.score} / ${exam.total_questions}` : label}
                                    </div>

                                    <div className="mb-4">
                                        <h3 className="font-bold text-lg text-slate-700">{exam.title}</h3>
                                        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                                            <Calendar size={12} />
                                            {isCompleted
                                                ? `Completed on ${new Date(exam.end_time || exam.created_at).toLocaleDateString()}`
                                                : `Created on ${new Date(exam.created_at).toLocaleDateString()}`}
                                        </p>
                                    </div>

                                    <div className="w-full bg-white rounded-xl p-3 border border-slate-200 flex items-center justify-between">
                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{isCompleted ? 'Performance' : 'Status'}</span>
                                        <span className={`text-sm font-black ${valueColor}`}>
                                            {isCompleted && hasScore ? `${Math.round((exam.score / exam.total_questions) * 100)}%` : 'Not Attempted'}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}

                        {historyExamsView.length === 0 && (
                            <div className="col-span-full flex flex-col items-center justify-center py-12 text-slate-400 bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
                                <p className="text-sm font-medium">Your completed exams and results will appear here.</p>
                            </div>
                        )}
                    </div>
                </section>

                {historyPagination && historyPagination.pages > 1 && (
                    <div className="pt-6">
                        <Pagination
                            currentPage={historyPage}
                            totalPages={historyPagination.pages}
                            onPageChange={setHistoryPage}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
