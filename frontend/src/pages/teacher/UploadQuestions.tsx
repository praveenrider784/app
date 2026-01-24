import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { Upload, FileSpreadsheet, Loader2, AlertCircle, CheckCircle, ChevronRight } from 'lucide-react';

export default function UploadQuestions() {
    const navigate = useNavigate();
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error', message: string, details?: any[] } | null>(null);
    const [lastUploadedData, setLastUploadedData] = useState<{ subject_id: string, unit: string } | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setStatus(null);
            setLastUploadedData(null);
        }
    };

    const handleUpload = async () => {
        if (!file) return;

        setLoading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const { data } = await api.post('/questions/upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            setStatus({
                type: 'success',
                message: data.message,
                details: data.errors
            });

            // Extract subject and unit for the "Quick Conduct" feature
            if (data.subject_id) {
                setLastUploadedData({
                    subject_id: data.subject_id,
                    unit: data.unit || ''
                });
            }

            setFile(null);
        } catch (error: any) {
            console.error(error);
            setStatus({
                type: 'error',
                message: error.response?.data?.error || 'Upload failed',
                details: error.response?.data?.details
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto">
            <div className="flex items-center space-x-4 mb-8">
                <div className="bg-green-100 p-3 rounded-xl text-green-700">
                    <FileSpreadsheet size={32} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Upload Questions</h1>
                    <p className="text-slate-500">Bulk import questions via Excel (XLSX)</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Upload Card */}
                <div className="lg:col-span-2 bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:bg-slate-50 transition-colors relative">
                        <input
                            key={status ? 'reset' : 'active'}
                            type="file"
                            accept=".xlsx, .xls, .csv"
                            onChange={handleFileChange}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <Upload size={48} className="text-slate-300 mb-4" />
                        {file ? (
                            <div>
                                <p className="text-slate-900 font-medium">{file.name}</p>
                                <p className="text-xs text-slate-500 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                            </div>
                        ) : (
                            <div>
                                <p className="text-slate-900 font-medium">Click or drag file to upload</p>
                                <p className="text-sm text-slate-500 mt-1">Supports .xlsx, .xls (Max 5MB)</p>
                            </div>
                        )}
                    </div>

                    <div className="mt-6 flex justify-end space-x-3">
                        {(file || status) && (
                            <button
                                onClick={() => { setFile(null); setStatus(null); }}
                                className="px-6 py-2.5 rounded-lg font-medium text-slate-600 hover:bg-slate-100 transition"
                            >
                                Reset
                            </button>
                        )}
                        <button
                            onClick={handleUpload}
                            disabled={!file || loading}
                            className="bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-lg font-medium flex items-center space-x-2 transition"
                        >
                            {loading ? <Loader2 className="animate-spin" size={20} /> : <Upload size={20} />}
                            <span>Upload Now</span>
                        </button>
                    </div>
                </div>

                {/* Template Instructions */}
                <div className="space-y-6">
                    <div className="bg-blue-50 p-6 rounded-xl border border-blue-100">
                        <h3 className="font-bold text-blue-900 mb-2">Excel Format Guide</h3>
                        <p className="text-sm text-blue-700 mb-4">Ensure your file has the following columns (headers are case-insensitive):</p>
                        <ul className="text-xs text-blue-800 space-y-2 list-disc pl-4 font-mono">
                            <li>Subject</li>
                            <li>Text (Question)</li>
                            <li>Option A</li>
                            <li>Option B</li>
                            <li>Option C</li>
                            <li>Option D</li>
                            <li>Correct Option (A/B/C/D)</li>
                            <li>Difficulty (Easy/Medium/Hard)</li>
                            <li>Unit (Chapter/Module Name)</li>
                        </ul>
                        <p className="text-[10px] text-blue-600 mt-4 leading-relaxed italic">
                            Tip: Providing a **Unit** allows you to filter questions by specific chapters when creating an exam!
                        </p>
                    </div>

                    {status && (
                        <div className={`p-6 rounded-[32px] border ${status.type === 'success' ? 'bg-green-50 border-green-100 text-green-800' : 'bg-red-50 border-red-100 text-red-800 shadow-lg shadow-red-50'}`}>
                            <div className="flex items-start space-x-4">
                                {status.type === 'success' ? <CheckCircle className="shrink-0 text-green-600" size={24} /> : <AlertCircle className="shrink-0 text-red-600" size={24} />}
                                <div className="flex-1">
                                    <p className="font-black text-lg leading-tight uppercase tracking-tight">{status.message}</p>

                                    {status.type === 'success' && lastUploadedData && (
                                        <div className="mt-6">
                                            <p className="text-sm text-green-700 mb-4 font-medium italic">Your questions are ready! Want to schedule an exam right now using this data?</p>
                                            <button
                                                onClick={() => navigate('/teacher/create-exam', { state: lastUploadedData })}
                                                className="bg-slate-900 hover:bg-black text-white px-6 py-3 rounded-2xl font-black flex items-center space-x-2 transition shadow-xl active:scale-95"
                                            >
                                                <span>Conduct Exam Now</span>
                                                <ChevronRight size={18} />
                                            </button>
                                        </div>
                                    )}

                                    {status.details && status.details.length > 0 && (
                                        <div className="mt-4 bg-white/60 p-4 rounded-2xl text-xs space-y-2 border border-green-200/50">
                                            <p className="font-bold text-green-900 border-b border-green-100 pb-2 mb-2 uppercase tracking-widest text-[10px]">Import Summary</p>
                                            {status.details.map((d: any, i: number) => (
                                                <p key={i} className="flex items-center gap-2">
                                                    <span className="w-1 h-1 bg-green-400 rounded-full" />
                                                    {typeof d === 'string' ? d : `Row ${d.row}: ${d.error}`}
                                                </p>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
