import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Save, FileText, Clock } from 'lucide-react';

export default function CreateExam() {
    const navigate = useNavigate();
    const [subjects, setSubjects] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const [title, setTitle] = useState('');
    const [duration, setDuration] = useState(60);
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [sections, setSections] = useState<any[]>([
        { filter: { subject_id: '', unit: '', difficulty: 'any' }, count: 10 }
    ]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const { data } = await api.get('/exams/form-data');
                setSubjects(data.subjects);

                // Handle pre-fill from location state (for "Quick Conduct")
                const state = (window.history.state as any)?.usr;
                if (state?.subject_id) {
                    setSections([{
                        filter: {
                            subject_id: state.subject_id,
                            unit: state.unit || '',
                            difficulty: 'any'
                        },
                        count: 10
                    }]);
                }
            } catch (error) {
                console.error("Failed to fetch form data");
            }
        };
        fetchData();
    }, []);

    const addSection = () => {
        setSections([...sections, { filter: { subject_id: '', unit: '', difficulty: 'any' }, count: 10 }]);
    };

    const removeSection = (index: number) => {
        setSections(sections.filter((_, i) => i !== index));
    };

    const updateSection = (index: number, field: string, value: any) => {
        const newSections = [...sections];
        if (field === 'count') {
            newSections[index].count = parseInt(value) || 0;
        } else {
            newSections[index].filter[field] = value;
            // Reset unit if subject changes
            if (field === 'subject_id') {
                newSections[index].filter.unit = '';
            }
        }
        setSections(newSections);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.post('/exams', {
                title,
                duration_minutes: duration,
                start_time: startTime || null,
                end_time: endTime || null,
                config: { sections }
            });
            navigate('/teacher/dashboard');
        } catch (error) {
            console.error("Failed to create exam");
            alert("Failed to create exam. Ensure you have enough questions for the selected filters.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="flex items-center space-x-4">
                <div className="bg-primary-100 p-3 rounded-xl text-primary-600">
                    <FileText size={32} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Create New Exam</h1>
                    <p className="text-slate-500">Design your automated question selection logic</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Basic Info */}
                <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2 col-span-full">
                            <label className="text-sm font-semibold text-slate-700">Exam Title</label>
                            <input
                                type="text"
                                required
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500 bg-slate-50/50"
                                placeholder="e.g., Mathematics Mid-Term 2024"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700 flex items-center space-x-2">
                                <Clock size={16} />
                                <span>Duration (Minutes)</span>
                            </label>
                            <input
                                type="number"
                                required
                                value={duration}
                                onChange={(e) => setDuration(parseInt(e.target.value))}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500 bg-slate-50/50"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700">Scheduled Start (Optional)</label>
                            <input
                                type="datetime-local"
                                value={startTime}
                                onChange={(e) => setStartTime(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500 bg-slate-50/50"
                            />
                        </div>
                        <div className="space-y-2 col-start-2">
                            <label className="text-sm font-semibold text-slate-700">Scheduled End (Optional)</label>
                            <input
                                type="datetime-local"
                                value={endTime}
                                onChange={(e) => setEndTime(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500 bg-slate-50/50"
                            />
                        </div>
                    </div>
                </div>

                {/* Question Selection Rules */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold text-slate-900">Question Selection Rules</h2>
                        <button
                            type="button"
                            onClick={addSection}
                            className="text-primary-600 hover:text-primary-700 font-medium flex items-center space-x-1 text-sm bg-primary-50 px-3 py-1.5 rounded-lg border border-primary-100 transition-colors"
                        >
                            <Plus size={16} />
                            <span>Add Filter Rule</span>
                        </button>
                    </div>

                    {sections.map((section, index) => (
                        <div key={index} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative animate-in fade-in slide-in-from-top-2">
                            {sections.length > 1 && (
                                <button
                                    type="button"
                                    onClick={() => removeSection(index)}
                                    className="absolute -top-3 -right-3 p-2 bg-white border border-slate-200 text-slate-400 hover:text-red-500 rounded-full shadow-sm hover:shadow transition-all"
                                >
                                    <Trash2 size={16} />
                                </button>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Subject</label>
                                    <select
                                        value={section.filter.subject_id}
                                        onChange={(e) => updateSection(index, 'subject_id', e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50/50"
                                        required
                                    >
                                        <option value="">Select Subject</option>
                                        {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Unit / Section</label>
                                    <select
                                        value={section.filter.unit}
                                        onChange={(e) => updateSection(index, 'unit', e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50/50"
                                        disabled={!section.filter.subject_id}
                                    >
                                        <option value="">Any Unit</option>
                                        {subjects.find(s => s.id.toString() === section.filter.subject_id.toString())?.units.map((u: string) => (
                                            <option key={u} value={u}>{u}</option>
                                        ))}
                                        {section.filter.subject_id && (subjects.find(s => s.id.toString() === section.filter.subject_id.toString())?.units.length === 0) && (
                                            <option disabled>No units found for this subject</option>
                                        )}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Difficulty</label>
                                    <select
                                        value={section.filter.difficulty}
                                        onChange={(e) => updateSection(index, 'difficulty', e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50/50"
                                    >
                                        <option value="any">Any Difficulty</option>
                                        <option value="easy">Easy</option>
                                        <option value="medium">Medium</option>
                                        <option value="hard">Hard</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">How many questions?</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={section.count}
                                        onChange={(e) => updateSection(index, 'count', e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50/50"
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer Buttons */}
                <div className="flex justify-end pt-4">
                    <button
                        type="submit"
                        disabled={loading}
                        className="bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white px-8 py-3 rounded-xl font-bold flex items-center space-x-2 shadow-lg shadow-primary-200 transition-all hover:-translate-y-0.5"
                    >
                        {loading ? <Plus className="animate-spin" size={20} /> : <Save size={20} />}
                        <span>{loading ? 'Creating...' : 'Finalize & Create Exam'}</span>
                    </button>
                </div>
            </form>
        </div>
    );
}
