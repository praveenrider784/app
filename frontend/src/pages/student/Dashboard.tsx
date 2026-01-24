import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { Play, Clock, AlertCircle, Loader2, CheckCircle2, Calendar } from 'lucide-react';
import Pagination from '../../components/common/Pagination';
import { useAuth } from '../../context/AuthContext';

export default function StudentDashboard() {
    const { user } = useAuth();
    const [exams, setExams] = useState<any[]>([]);
    const [pagination, setPagination] = useState<any>(null);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const LIMIT = 6;

    useEffect(() => {
        const fetchExams = async () => {
            setLoading(true);
            try {
                const { data } = await api.get(`/student/exams?page=${page}&limit=${LIMIT}`);
                setExams(data.exams);
                setPagination(data.pagination);
            } catch (error) {
                console.error("Failed to fetch exams");
            } finally {
                setLoading(false);
            }
        };
        fetchExams();
    }, [page]);

    const handleStartExam = (examId: string) => {
        navigate(`/student/exam/${examId}`);
    };

    if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary-600" size={40} /></div>;

    return (
        <div className="space-y-8 pb-12">
            <header className="relative py-8 px-8 bg-slate-900 rounded-[32px] overflow-hidden shadow-2xl shadow-slate-200">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/10 rounded-full -mr-20 -mt-20 blur-3xl" />
                <div className="relative z-10">
                    <h1 className="text-4xl font-black text-white leading-tight">Hii, <br />{user?.name || 'Student'}</h1>
                    <p className="text-slate-400 mt-2 font-medium">Keep track of your active exams and performance.</p>
                </div>
            </header>

            <div className="px-1">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Active Sessions</h2>
                    <div className="h-px flex-1 bg-slate-100 mx-6" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {exams.map((exam) => (
                        <div key={exam.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition relative overflow-hidden group">
                            {exam.attempt_status === 'completed' && (
                                <div className="absolute top-0 right-0 bg-green-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg uppercase tracking-wider flex items-center gap-1">
                                    <CheckCircle2 size={10} />
                                    Completed: {exam.score} Marks
                                </div>
                            )}

                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="font-bold text-lg text-slate-900 group-hover:text-primary-600 transition-colors">{exam.title}</h3>
                                    <div className="flex flex-col gap-1 mt-1">
                                        <p className="text-sm text-slate-500 flex items-center gap-1">
                                            <Clock size={14} /> {exam.duration_minutes} Mins
                                        </p>
                                        {(exam.start_time || exam.end_time) && (
                                            <p className="text-[10px] text-slate-400 flex items-center gap-1 font-bold uppercase tracking-wider">
                                                <Calendar size={12} />
                                                {exam.start_time ? new Date(exam.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'}
                                                {' - '}
                                                {exam.end_time ? new Date(exam.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Until Active'}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={() => handleStartExam(exam.id)}
                                disabled={exam.attempt_status === 'completed'}
                                className={`w-full font-bold py-3 rounded-xl flex items-center justify-center space-x-2 transition ${exam.attempt_status === 'completed'
                                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                    : 'bg-primary-600 hover:bg-primary-700 text-white shadow-lg shadow-primary-200'
                                    }`}
                            >
                                <Play size={18} />
                                <span>{exam.attempt_status === 'completed' ? 'Exam Finished' : 'Start Exam Now'}</span>
                            </button>
                        </div>
                    ))}

                    {exams.length === 0 && (
                        <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-400 bg-white rounded-3xl border border-dashed border-slate-200">
                            <AlertCircle size={48} className="mb-4 opacity-20" />
                            <p className="font-medium">No active exams from your school right now.</p>
                            <p className="text-xs">Check back later or contact your teacher.</p>
                        </div>
                    )}
                </div>

                {pagination && pagination.pages > 1 && (
                    <Pagination
                        currentPage={page}
                        totalPages={pagination.pages}
                        onPageChange={setPage}
                    />
                )}
            </div>
        </div>
    );
}
