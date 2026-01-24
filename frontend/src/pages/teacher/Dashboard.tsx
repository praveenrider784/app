import { useEffect, useState } from 'react';
import api from '../../services/api';
import { Share2, X, Users, BookOpen, LayoutDashboard, Database, Loader2, ChevronLeft, ArrowLeft, Trophy } from 'lucide-react';
import QRCode from 'react-qr-code';
import Pagination from '../../components/common/Pagination';
import { useAuth } from '../../context/AuthContext';

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
    const [subjectFilter, setSubjectFilter] = useState('all');
    const [loading, setLoading] = useState(true);
    const EXAM_LIMIT = 5;

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const { data } = await api.get('/exams/stats');
                setStats(data);
            } catch (e) {
                console.error("Stats fetch failed");
            }
        };
        fetchStats();
    }, []);

    useEffect(() => {
        const fetchPaginatedExams = async () => {
            setLoading(true);
            try {
                const { data } = await api.get(`/exams?page=${page}&limit=${EXAM_LIMIT}`);
                setExams(data.exams);
                setPagination(data.pagination);
            } catch (error) {
                console.error("Failed to fetch exams");
            } finally {
                setLoading(false);
            }
        };
        if (activeTab === 'exams') fetchPaginatedExams();
    }, [page, activeTab]);

    const fetchStudents = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/auth/students');
            setStudents(data);
        } catch (error) {
            console.error("Failed to fetch students");
        } finally {
            setLoading(false);
        }
    };

    const fetchQuestions = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/questions');
            setQuestions(data);
        } catch (error) {
            console.error("Failed to fetch questions");
        } finally {
            setLoading(false);
        }
    };

    const handleInspectExam = async (exam: any) => {
        setLoading(true);
        setInspectedExam(exam);
        try {
            const { data } = await api.get(`/exams/${exam.id}/attempts`);
            setSelectedExamResults(data);
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
    }, [activeTab]);

    const openShare = (exam: any) => setSelectedExamForShare(exam);
    const closeShare = () => setSelectedExamForShare(null);

    return (
        <div className="space-y-6 relative pb-12">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h1 className="text-2xl font-black text-slate-900 leading-tight uppercase tracking-tight">Welcome back, {user?.name || 'Instructor'}</h1>
                <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button
                        onClick={() => setActiveTab('exams')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition ${activeTab === 'exams' || activeTab === 'exam_results' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <LayoutDashboard size={16} /> Exams
                    </button>
                    <button
                        onClick={() => setActiveTab('students')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition ${activeTab === 'students' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Users size={16} /> Students
                    </button>
                    <button
                        onClick={() => setActiveTab('questions')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition ${activeTab === 'questions' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Database size={16} /> Question Bank
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 transition-transform hover:scale-[1.02]">
                    <div className="bg-primary-50 p-3 rounded-xl text-primary-600"><BookOpen size={24} /></div>
                    <div>
                        <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider">Active Exams</h3>
                        <p className="text-2xl font-black text-slate-900">{stats.exams}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 transition-transform hover:scale-[1.02]">
                    <div className="bg-green-50 p-3 rounded-xl text-green-600"><Users size={24} /></div>
                    <div>
                        <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider">Total Students</h3>
                        <p className="text-2xl font-black text-slate-900">{stats.students}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 transition-transform hover:scale-[1.02]">
                    <div className="bg-orange-50 p-3 rounded-xl text-orange-600"><Database size={24} /></div>
                    <div>
                        <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider">Question Bank</h3>
                        <p className="text-2xl font-black text-slate-900">{stats.questions}</p>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm min-h-[400px]">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                        <Loader2 className="animate-spin mb-4" size={40} />
                        <p className="text-sm font-medium">Fetching your data...</p>
                    </div>
                ) : (
                    <div className="p-6">
                        {activeTab === 'exams' && (
                            <div className="space-y-4">
                                <h3 className="font-bold text-slate-900 mb-4 uppercase tracking-tight text-sm">Live Exam Management</h3>
                                {exams.length === 0 ? (
                                    <p className="text-slate-400 text-center py-10 font-medium">No exams created yet.</p>
                                ) : (
                                    <div className="grid grid-cols-1 gap-4">
                                        {exams.map((exam) => (
                                            <div key={exam.id} className="flex justify-between items-center p-4 rounded-2xl border border-slate-50 hover:border-primary-100 hover:bg-primary-50/10 transition-all group cursor-pointer" onClick={() => handleInspectExam(exam)}>
                                                <div>
                                                    <h4 className="font-bold text-slate-900 group-hover:text-primary-600 transition-colors uppercase tracking-tight">{exam.title}</h4>
                                                    <p className="text-[10px] text-slate-500 mt-1 uppercase font-bold tracking-widest">{exam.duration_minutes} mins • {exam.is_active ? '✅ Active' : '🏗️ Draft'}</p>
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
                                                        onClick={async (e) => {
                                                            e.stopPropagation();
                                                            if (window.confirm('Are you sure you want to delete this exam? This action cannot be undone.')) {
                                                                try {
                                                                    await api.delete(`/exams/${exam.id}`);
                                                                    setExams(exams.filter(ex => ex.id !== exam.id));
                                                                } catch (err) {
                                                                    alert('Failed to delete exam');
                                                                }
                                                            }
                                                        }}
                                                        className="p-3 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all active:scale-95"
                                                        title="Delete Exam"
                                                    >
                                                        <X size={20} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
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
                                                    <th className="pb-4 font-black">Student Name</th>
                                                    <th className="pb-4 font-black text-center">Score</th>
                                                    <th className="pb-4 font-black text-right">Submitted At</th>
                                                </tr>
                                            </thead>
                                            <tbody className="text-sm">
                                                {selectedExamResults.map(res => (
                                                    <tr key={res.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition">
                                                        <td className="py-5 font-bold text-slate-900">
                                                            <div>
                                                                <p className="leading-none">{res.full_name}</p>
                                                                <p className="text-[10px] text-slate-400 mt-2 uppercase tracking-wider font-bold">{res.email}</p>
                                                            </div>
                                                        </td>
                                                        <td className="py-5 text-center">
                                                            <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-50 text-green-600 rounded-lg font-black text-xs border border-green-100">
                                                                <Trophy size={12} /> {res.score} / {res.total_questions}
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
