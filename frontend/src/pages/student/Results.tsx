import { useEffect, useState } from 'react';
import api from '../../services/api';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import Pagination from '../../components/common/Pagination';

export default function StudentResults() {
    const [results, setResults] = useState<any[]>([]);
    const [pagination, setPagination] = useState<any>(null);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const LIMIT = 10;

    useEffect(() => {
        const fetchResults = async () => {
            setLoading(true);
            try {
                const { data } = await api.get(`/student/exams?page=${page}&limit=${LIMIT}`);
                // Filter only completed exams (Backend returns all, we filter completed)
                setResults(data.exams.filter((e: any) => e.attempt_status === 'completed'));
                setPagination(data.pagination);
            } catch (error) {
                console.error("Failed to fetch results");
            } finally {
                setLoading(false);
            }
        };
        fetchResults();
    }, [page]);

    if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary-600" size={40} /></div>;

    return (
        <div className="space-y-8 pb-12">
            <header className="relative py-8 px-8 bg-slate-900 rounded-[32px] overflow-hidden shadow-2xl shadow-slate-200">
                <div className="absolute top-0 right-0 w-64 h-64 bg-green-500/10 rounded-full -mr-20 -mt-20 blur-3xl" />
                <div className="relative z-10">
                    <h1 className="text-4xl font-black text-white leading-tight">Exam Reports</h1>
                    <p className="text-slate-400 mt-2 font-medium">A direct breakdown of your scores and performance.</p>
                </div>
            </header>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Test Name</th>
                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Score / Max</th>
                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Percent</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {results.map((res) => {
                            const percentage = res.total_questions > 0 ? Math.round((res.score / res.total_questions) * 100) : 0;

                            return (
                                <tr key={res.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center font-black text-xs">
                                                {res.title.charAt(0).toUpperCase()}
                                            </div>
                                            <span className="font-bold text-slate-900">{res.title}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 text-sm text-slate-500 font-medium whitespace-nowrap">
                                        {new Date(res.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="flex items-baseline gap-1 font-black">
                                            <span className="text-xl text-slate-900">{res.score}</span>
                                            <span className="text-sm text-slate-500">/ {res.total_questions}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 text-right">
                                        <span className={cn(
                                            "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter",
                                            percentage >= 50 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                                        )}>
                                            {percentage}%
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}

                        {results.length === 0 && (
                            <tr>
                                <td colSpan={4} className="px-6 py-20 text-center text-slate-400">
                                    <CheckCircle2 size={40} className="mx-auto mb-2 opacity-20" />
                                    <p className="text-sm font-medium">No results found.</p>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {pagination && pagination.pages > 1 && (
                <Pagination
                    currentPage={page}
                    totalPages={pagination.pages}
                    onPageChange={setPage}
                    className="mt-6"
                />
            )}
        </div>
    );
}
