import { useEffect, useState } from 'react';
import api from '../../services/api';
import { Loader2, Users, FileText, TrendingUp, Award, Calendar } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function DetailedResults() {
    const [exams, setExams] = useState<any[]>([]);
    const [selectedExam, setSelectedExam] = useState<string | null>(null);
    const [attempts, setAttempts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [detailsLoading, setDetailsLoading] = useState(false);

    useEffect(() => {
        const fetchExamsWithAttempts = async () => {
            try {
                const { data } = await api.get('/exams');
                setExams(data);
                if (data.length > 0) {
                    setSelectedExam(data[0].id);
                }
            } catch (error) {
                console.error("Failed to fetch exams");
            } finally {
                setLoading(false);
            }
        };
        fetchExamsWithAttempts();
    }, []);

    useEffect(() => {
        if (!selectedExam) return;

        const fetchAttempts = async () => {
            setDetailsLoading(true);
            try {
                const { data } = await api.get(`/exams/${selectedExam}/attempts`);
                setAttempts(data);
            } catch (error) {
                console.error("Failed to fetch attempts");
            } finally {
                setDetailsLoading(false);
            }
        };
        fetchAttempts();
    }, [selectedExam]);

    if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary-600" size={40} /></div>;

    return (
        <div className="space-y-8">
            <header>
                <h1 className="text-3xl font-black text-slate-900">Exam Reports</h1>
                <p className="text-slate-500 mt-1">Review student scores and submission times</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Exam Selector */}
                <div className="lg:col-span-1 space-y-4">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Select Exam</h3>
                    <div className="space-y-2">
                        {exams.map(exam => (
                            <button
                                key={exam.id}
                                onClick={() => setSelectedExam(exam.id)}
                                className={cn(
                                    "w-full text-left p-4 rounded-2xl border transition-all flex items-center gap-3",
                                    selectedExam === exam.id
                                        ? "bg-slate-900 text-white border-slate-900 shadow-lg"
                                        : "bg-white text-slate-600 border-slate-100 hover:border-primary-200"
                                )}
                            >
                                <FileText size={18} />
                                <span className="font-bold text-sm truncate">{exam.title}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Attempt Table */}
                <div className="lg:col-span-3 space-y-4">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Student Performance</h3>
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm min-h-[500px] overflow-hidden">
                        {detailsLoading ? (
                            <div className="flex flex-col items-center justify-center h-full py-20 text-slate-400">
                                <Loader2 className="animate-spin mb-4" size={40} />
                                <p className="text-sm font-medium">Crunching the numbers...</p>
                            </div>
                        ) : attempts.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full py-20 text-slate-400">
                                <Users size={48} className="mb-4 opacity-20" />
                                <p className="font-medium">No attempts recorded for this exam yet.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50">
                                        <tr className="text-[10px] text-slate-400 uppercase tracking-widest">
                                            <th className="px-8 py-5 font-black">Student</th>
                                            <th className="px-8 py-5 font-black">Submission Time</th>
                                            <th className="px-8 py-5 font-black">Correct</th>
                                            <th className="px-8 py-5 font-black">Total</th>
                                            <th className="px-8 py-5 font-black text-right">Percentage</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-sm">
                                        {attempts.map(attempt => {
                                            const percentage = Math.round((attempt.score / attempt.total_questions) * 100);
                                            return (
                                                <tr key={attempt.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                                                    <td className="px-8 py-5">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 bg-primary-100 text-primary-600 rounded-lg flex items-center justify-center font-black text-xs">
                                                                {attempt.full_name?.charAt(0)}
                                                            </div>
                                                            <span className="font-bold text-slate-900">{attempt.full_name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-5 text-slate-500 font-medium">
                                                        <div className="flex items-center gap-2">
                                                            <Calendar size={14} className="text-slate-300" />
                                                            {new Date(attempt.end_time).toLocaleString()}
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-5">
                                                        <span className="text-lg font-black text-slate-900">{attempt.score}</span>
                                                        <span className="text-xs text-slate-300 ml-1 font-bold">/ {attempt.total_questions}</span>
                                                    </td>
                                                    <td className="hidden px-8 py-5 text-slate-400 font-bold sm:table-cell">{attempt.total_questions}</td>
                                                    <td className="px-8 py-5 text-right">
                                                        <div className="flex items-center justify-end gap-2 font-black text-primary-600">
                                                            {percentage}%
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
