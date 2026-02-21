import { useEffect, useState } from 'react';
import api from '../../services/api';
import { Share2, Trash2, Users, BookOpen, LayoutDashboard, Database, Loader2, ChevronLeft, ArrowLeft, Trophy, Clock, Calendar, CheckCircle, X } from 'lucide-react';
import QRCode from 'react-qr-code';
import Pagination from '../../components/common/Pagination';
import { useAuth } from '../../context/AuthContext';
import ConfirmModal from '../../components/common/ConfirmModal';

export default function TeacherDashboard() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'exams' | 'students' | 'questions' | 'exam_results'>('exams');
    const [exams, setExams] = useState<any[]>([]);
    const [pagination, setPagination] = useState<any>(null);
    const [page, setPage] = useState(1);
    const [students, setStudents] = useState<any[]>([]);
    const [questions, setQuestions] = useState<any[]>([]);
    const [selectedExamResults, setSelectedExamResults] = useState<any[]>([]);
    const [inspectedExam, setInspectedExam] = useState<any | null>(null);
    const [stats, setStats] = useState({ students: 0, questions: 0, exams: 0 });
    const [selectedExamForShare, setSelectedExamForShare] = useState<any | null>(null);
    const [examToDelete, setExamToDelete] = useState<any | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [subjectFilter, setSubjectFilter] = useState('all');
    const [loading, setLoading] = useState(true);
    const EXAM_LIMIT = 5;

    const fetchStats = async () => {
        try {
            const { data } = await api.get('/exams/stats');
            setStats(data);
        } catch (e) {
            console.error("Stats fetch failed");
        }
    };

    const fetchPaginatedExams = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const { data } = await api.get(`/exams?page=${page}&limit=${EXAM_LIMIT}`);
            setExams(data.exams);
            setPagination(data.pagination);
        } catch (error) {
            console.error("Failed to fetch exams");
        } finally {
            if (!silent) setLoading(false);
        }
    };

    const fetchStudents = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const { data } = await api.get('/auth/students');
            setStudents(data);
        } catch (error) {
            console.error("Failed to fetch students");
        } finally {
            if (!silent) setLoading(false);
        }
    };

    const fetchQuestions = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const { data } = await api.get('/questions');
            setQuestions(data);
        } catch (error) {
            console.error("Failed to fetch questions");
        } finally {
            if (!silent) setLoading(false);
        }
    };

    const fetchExamResults = async (silent = false) => {
        if (!inspectedExam) return;
        if (!silent) setLoading(true);
        try {
            const { data } = await api.get(`/exams/${inspectedExam.id}/attempts`);
            setSelectedExamResults(data.sort((a: any, b: any) => {
                if (b.score !== a.score) return b.score - a.score;
                return a.full_name.localeCompare(b.full_name);
            }));
        } catch (e) {
            console.error("Failed to fetch exam results");
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, []);

    useEffect(() => {
        if (activeTab === 'exams') fetchPaginatedExams();
    }, [page, activeTab]);

    const handleInspectExam = async (exam: any) => {
        setLoading(true);
        setInspectedExam(exam);
        try {
            const { data } = await api.get(`/exams/${exam.id}/attempts`);
            // Sort by score DESC, then name ASC for leaderboard
            setSelectedExamResults(data.sort((a: any, b: any) => {
                if (b.score !== a.score) return b.score - a.score;
                return a.full_name.localeCompare(b.full_name);
            }));
            setActiveTab('exam_results');
        } catch (e) {
            console.error("Failed to fetch exam results");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'students') fetchStudents();
        if (activeTab === 'questions') fetchQuestions();
        if (activeTab === 'exam_results') fetchExamResults();
    }, [activeTab, inspectedExam]);

    useEffect(() => {
        const interval = setInterval(() => {
            fetchStats();
            if (activeTab === 'exams') fetchPaginatedExams(true);
            if (activeTab === 'students') fetchStudents(true);
            if (activeTab === 'questions') fetchQuestions(true);
            if (activeTab === 'exam_results') fetchExamResults(true);
        }, 30000);
        return () => clearInterval(interval);
    }, [activeTab, page, inspectedExam]);

    const openShare = (exam: any) => setSelectedExamForShare(exam);
    const closeShare = () => setSelectedExamForShare(null);

    const getExamStatus = (exam: any) => {
        if (!exam.is_active) return { label: 'Draft', color: 'bg-slate-100 text-slate-500' };
        const now = new Date();
        const start = exam.start_time ? new Date(exam.start_time) : null;
        const end = exam.end_time ? new Date(exam.end_time) : null;

        if (start && start > now) return { label: 'Scheduled', color: 'bg-amber-50 text-amber-600 border-amber-100' };
        if (end && end < now) return { label: 'Ended', color: 'bg-red-50 text-red-600 border-red-100' };
        return { label: 'Live', color: 'bg-green-50 text-green-600 border-green-100' };
    };

    const handleDeleteExam = async () => {
        if (!examToDelete) return;
        setIsDeleting(true);
        try {
            await api.delete(`/exams/${examToDelete.id}`);

            // Refresh EVERYTHING immediately
            const fetchStats = async () => {
                try {
                    const { data } = await api.get('/exams/stats');
                    setStats(data);
                } catch (e) { }
            };

            const fetchExams = async () => {
                try {
                    const { data } = await api.get(`/exams?page=${exams.length === 1 && page > 1 ? page - 1 : page}&limit=${EXAM_LIMIT}`);
                    setExams(data.exams);
                    setPagination(data.pagination);
                    if (exams.length === 1 && page > 1) setPage(page - 1);
                } catch (e) { }
            };

            await Promise.all([fetchStats(), fetchExams()]);
            setExamToDelete(null);
        } catch (err) {
            alert('Failed to delete exam');
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="space-y-6 relative pb-12">
            <header className="relative py-8 px-8 bg-slate-900 rounded-[32px] overflow-hidden shadow-2xl shadow-slate-200 group">
                <div className="absolute top-0 right-0 w-80 h-80 bg-primary-600/20 rounded-full -mr-24 -mt-24 blur-[80px] animate-pulse" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-600/10 rounded-full -ml-24 -mb-24 blur-[60px]" />

                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div>
                        <h1 className="text-3xl font-black text-white leading-tight tracking-tight uppercase">
                            Welcome back, <br />
                            <span className="text-primary-400">
                                {user?.name || 'Instructor'}
                            </span>
                        </h1>
                        <p className="text-slate-400 mt-2 font-medium text-base">Overview of your academic activities.</p>
                    </div>

                    <div className="flex bg-white/5 backdrop-blur-md p-1 rounded-xl border border-white/10 glass shrink-0">
                        <button
                            onClick={() => setActiveTab('exams')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-black transition-all ${activeTab === 'exams' || activeTab === 'exam_results' ? 'bg-white text-slate-900 shadow-lg' : 'text-slate-400 hover:text-white'}`}
                        >
                            <LayoutDashboard size={16} /> Exams
                        </button>
                        <button
                            onClick={() => setActiveTab('students')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-black transition-all ${activeTab === 'students' ? 'bg-white text-slate-900 shadow-lg' : 'text-slate-400 hover:text-white'}`}
                        >
                            <Users size={16} /> Students
                        </button>
                        <button
                            onClick={() => setActiveTab('questions')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-black transition-all ${activeTab === 'questions' ? 'bg-white text-slate-900 shadow-lg' : 'text-slate-400 hover:text-white'}`}
                        >
                            <Database size={16} /> Bank
                        </button>
                    </div>
                </div>
            </header>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div
                    onClick={() => setActiveTab('exams')}
                    className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-xl shadow-slate-200/40 flex items-center gap-4 transition-all hover:scale-[1.02] group cursor-pointer active:scale-95"
                >
                    <div className="bg-primary-50 p-3 rounded-xl text-primary-600 group-hover:bg-primary-600 group-hover:text-white transition-colors shrink-0">
                        <BookOpen size={24} />
                    </div>
                    <div>
                        <h3 className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-0.5">Live</h3>
                        <p className="text-2xl font-black text-slate-900">{stats.exams}</p>
                    </div>
                </div>
                <div
                    onClick={() => setActiveTab('students')}
                    className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/50 flex items-center gap-6 transition-all hover:scale-[1.02] group cursor-pointer active:scale-95"
                >
                    <div className="bg-green-50 p-4 rounded-2xl text-green-600 group-hover:bg-green-600 group-hover:text-white transition-colors">
                        <Users size={28} />
                    </div>
                    <div>
                        <h3 className="text-slate-400 text-xs font-black uppercase tracking-[0.2em] mb-1">Total Students</h3>
                        <p className="text-3xl font-black text-slate-900">{stats.students}</p>
                    </div>
                </div>
                <div
                    onClick={() => setActiveTab('questions')}
                    className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/50 flex items-center gap-6 transition-all hover:scale-[1.02] group cursor-pointer active:scale-95"
                >
                    <div className="bg-orange-50 p-4 rounded-2xl text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition-colors">
                        <Database size={28} />
                    </div>
                    <div>
                        <h3 className="text-slate-400 text-xs font-black uppercase tracking-[0.2em] mb-1">Question Bank</h3>
                        <p className="text-3xl font-black text-slate-900">{stats.questions}</p>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="bg-white rounded-[40px] border border-slate-100 shadow-2xl shadow-slate-200/50 min-h-[500px] overflow-hidden">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                        <Loader2 className="animate-spin mb-4" size={40} />
                        <p className="text-sm font-medium">Fetching your data...</p>
                    </div>
                ) : (
                    <div className="p-6">
                        {activeTab === 'exams' && (
                            <div className="space-y-4">
                                <h3 className="font-bold text-slate-900 mb-4 uppercase tracking-tight text-sm">Exam Management</h3>
                                {exams.length === 0 ? (
                                    <p className="text-slate-400 text-center py-10 font-medium">No exams created yet.</p>
                                ) : (
                                    <div className="grid grid-cols-1 gap-4">
                                        {exams.map((exam) => {
                                            const status = getExamStatus(exam);
                                            return (
                                                <div key={exam.id} className="flex justify-between items-center p-5 rounded-2xl border border-slate-100 hover:border-primary-100 hover:bg-primary-50/5 transition-all group cursor-pointer" onClick={() => handleInspectExam(exam)}>
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-3 mb-2">
                                                            <h4 className="font-black text-slate-900 group-hover:text-primary-600 transition-colors uppercase tracking-tight">{exam.title}</h4>
                                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase border ${status.color}`}>
                                                                {status.label}
                                                            </span>
                                                        </div>
                                                        <div className="flex flex-wrap items-center gap-y-2 gap-x-6">
                                                            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest flex items-center gap-1">
                                                                <Clock size={12} /> {exam.duration_minutes} mins
                                                            </p>
                                                            {(exam.start_time || exam.end_time) && (
                                                                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest flex items-center gap-1">
                                                                    <Calendar size={12} />
                                                                    {exam.start_time ? new Date(exam.start_time).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Anytime'}
                                                                    {' → '}
                                                                    {exam.end_time ? new Date(exam.end_time).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Always'}
                                                                </p>
                                                            )}
                                                            <p className="text-[10px] text-primary-600 uppercase font-bold tracking-widest flex items-center gap-1">
                                                                <Users size={12} /> {exam.attempt_count || 0} Attempts
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); openShare(exam); }}
                                                            className="p-3 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-xl transition-all active:scale-95"
                                                            title="Get Share Link"
                                                        >
                                                            <Share2 size={20} />
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setExamToDelete(exam);
                                                            }}
                                                            className="p-3 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all active:scale-95"
                                                            title="Delete Exam"
                                                        >
                                                            <Trash2 size={20} />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {pagination && pagination.pages > 1 && (
                                    <Pagination
                                        currentPage={page}
                                        totalPages={pagination.pages}
                                        onPageChange={setPage}
                                        className="mt-8"
                                    />
                                )}
                            </div>
                        )}

                        {activeTab === 'exam_results' && inspectedExam && (
                            <div className="space-y-6">
                                <div className="flex items-center gap-4 mb-4">
                                    <button
                                        onClick={() => setActiveTab('exams')}
                                        className="p-2 hover:bg-slate-100 rounded-xl transition text-slate-500 active:scale-90"
                                    >
                                        <ArrowLeft size={20} />
                                    </button>
                                    <div>
                                        <h3 className="font-black text-slate-900 uppercase tracking-tight leading-none">Exam Inspection</h3>
                                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mt-2 leading-none">{inspectedExam.title}</p>
                                    </div>
                                </div>

                                {selectedExamResults.length === 0 ? (
                                    <div className="py-20 text-center bg-slate-50 rounded-[32px] border border-dashed border-slate-200">
                                        <Users size={40} className="mx-auto mb-3 opacity-20 text-slate-400" />
                                        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No students have completed this exam yet.</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left">
                                            <thead>
                                                <tr className="text-[10px] text-slate-400 uppercase tracking-[0.2em] border-b border-slate-50">
                                                    <th className="pb-4 font-black">Rank</th>
                                                    <th className="pb-4 font-black">Student Name</th>
                                                    <th className="pb-4 font-black text-center">Score</th>
                                                    <th className="pb-4 font-black text-right">Submitted At</th>
                                                </tr>
                                            </thead>
                                            <tbody className="text-sm">
                                                {selectedExamResults.map((res, idx) => (
                                                    <tr key={res.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition">
                                                        <td className="py-5 font-black text-slate-900">
                                                            {idx === 0 ? <span className="text-yellow-500 flex items-center gap-1"><Trophy size={14} /> 1st</span> :
                                                                idx === 1 ? <span className="text-slate-400 flex items-center gap-1"><Trophy size={14} /> 2nd</span> :
                                                                    idx === 2 ? <span className="text-amber-600 flex items-center gap-1"><Trophy size={14} /> 3rd</span> :
                                                                        <span className="text-slate-400 ml-5">{idx + 1}th</span>}
                                                        </td>
                                                        <td className="py-5 font-bold text-slate-900">
                                                            <div>
                                                                <p className="leading-none">{res.full_name}</p>
                                                                <p className="text-[10px] text-slate-400 mt-2 uppercase tracking-wider font-bold">{res.email}</p>
                                                            </div>
                                                        </td>
                                                        <td className="py-5 text-center">
                                                            <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-50 text-green-600 rounded-lg font-black text-xs border border-green-100">
                                                                <CheckCircle size={12} /> {res.score} / {res.total_questions}
                                                            </div>
                                                        </td>
                                                        <td className="py-5 text-right text-slate-500 font-medium">
                                                            {new Date(res.end_time).toLocaleString()}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'students' && (
                            <div className="space-y-4">
                                <h3 className="font-bold text-slate-900 mb-4 uppercase tracking-tight text-sm">Registered Students</h3>
                                {students.length === 0 ? (
                                    <p className="text-slate-400 text-center py-10 font-medium">Waiting for students to sign up to your school.</p>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left">
                                            <thead>
                                                <tr className="text-[10px] text-slate-400 uppercase tracking-[0.2em] border-b border-slate-50">
                                                    <th className="pb-4 font-black">Name</th>
                                                    <th className="pb-4 font-black">Email</th>
                                                    <th className="pb-4 font-black text-right">Joined</th>
                                                </tr>
                                            </thead>
                                            <tbody className="text-sm">
                                                {students.map(s => (
                                                    <tr key={s.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition">
                                                        <td className="py-5 font-bold text-slate-900">{s.full_name}</td>
                                                        <td className="py-5 text-slate-500 font-medium">{s.email}</td>
                                                        <td className="py-5 text-right text-slate-400 font-bold">{new Date(s.created_at).toLocaleDateString()}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'questions' && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-bold text-slate-900 uppercase tracking-tight text-sm">My Question Library</h3>
                                    <select
                                        className="text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 focus:ring-2 focus:ring-primary-500 transition-all outline-none"
                                        value={subjectFilter}
                                        onChange={(e) => setSubjectFilter(e.target.value)}
                                    >
                                        <option value="all">All Subjects</option>
                                        {Array.from(new Set(questions.map(q => q.subject_name))).map(name => (
                                            <option key={name} value={name}>{name}</option>
                                        ))}
                                    </select>
                                </div>

                                {questions.length === 0 ? (
                                    <p className="text-slate-400 text-center py-10 font-medium">Upload your first Excel file to see questions here.</p>
                                ) : (
                                    <div className="grid grid-cols-1 gap-4">
                                        {questions
                                            .filter(q => subjectFilter === 'all' || q.subject_name === subjectFilter)
                                            .map((q) => (
                                                <div key={q.id} className="p-6 rounded-[32px] border border-slate-50 hover:shadow-xl hover:border-slate-100 transition-all bg-slate-50/20">
                                                    <div className="flex items-center gap-2 mb-4">
                                                        <span className="px-2 py-0.5 bg-primary-50 text-primary-600 text-[10px] font-black uppercase rounded tracking-wider">{q.subject_name}</span>
                                                        <span className={`px-2 py-0.5 text-[10px] font-black uppercase rounded tracking-wider ${q.difficulty === 'easy' ? 'bg-green-50 text-green-600' :
                                                            q.difficulty === 'hard' ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600'
                                                            }`}>{q.difficulty}</span>
                                                    </div>
                                                    <p className="text-base text-slate-800 font-bold leading-relaxed">{q.text}</p>
                                                    {q.unit && <p className="text-[10px] text-slate-400 mt-4 font-black uppercase tracking-[0.2em]">Unit: {q.unit}</p>}
                                                </div>
                                            ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Confirm Delete Modal */}
            <ConfirmModal
                isOpen={!!examToDelete}
                onClose={() => setExamToDelete(null)}
                onConfirm={handleDeleteExam}
                isLoading={isDeleting}
                title="Delete Exam?"
                message={`Are you sure you want to delete "${examToDelete?.title}"? This action will permanently remove all student responses and history associated with this exam.`}
            />

            {/* QR Modal */}
            {selectedExamForShare && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-md">
                    <div className="bg-white rounded-[40px] p-10 max-w-sm w-full shadow-2xl animate-in zoom-in duration-300">
                        <div className="flex justify-between items-start mb-8">
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 leading-tight">Share Exam</h3>
                                <p className="text-[10px] text-slate-400 uppercase tracking-[0.2em] font-black mt-2 leading-none">{selectedExamForShare.title}</p>
                            </div>
                            <button onClick={closeShare} className="p-2 bg-slate-50 text-slate-400 hover:text-slate-600 rounded-xl transition active:scale-90">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex flex-col items-center space-y-8">
                            <div className="bg-white p-8 border-4 border-slate-50 rounded-[40px] shadow-sm">
                                <QRCode value={`${window.location.origin}/student/exam/${selectedExamForShare.id}`} size={200} />
                            </div>
                            <div className="w-full bg-slate-50 p-6 rounded-3xl text-[10px] font-mono break-all text-slate-600 border border-slate-100 flex flex-col gap-3 relative">
                                <p className="font-black text-slate-400 uppercase tracking-widest leading-none">Access Link</p>
                                <p className="leading-relaxed">{`${window.location.origin}/student/exam/${selectedExamForShare.id}`}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
