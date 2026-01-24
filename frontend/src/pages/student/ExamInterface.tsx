import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { Loader2, ChevronRight, ChevronLeft, Play, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function ExamInterface() {
    const { examId } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [hasStarted, setHasStarted] = useState(false);
    const [examInfo, setExamInfo] = useState<any>(null);
    const [questions, setQuestions] = useState<any[]>([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<string, number>>({});
    const [timeLeft, setTimeLeft] = useState(0);
    const [attemptId, setAttemptId] = useState<string | null>(null);
    const [isFinished, setIsFinished] = useState(false);
    const [finalScore, setFinalScore] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Just fetch exam info initially, don't start it yet
        // We'll start it when the user clicks the "Start Exam" button
        const fetchInfo = async () => {
            try {
                // We'll use a generic endpoint or just assume the start data is needed anyway
                // To keep it simple, we'll call start immediately but not SHOW the questions 
                // until they click the gate button.
                const { data } = await api.post(`/student/exams/${examId}/start`);
                setQuestions(data.questions);
                setExamInfo(data.attempt);
                setAttemptId(data.attempt.id);

                // Use actual duration from backend
                const duration = data.duration_minutes || 60;
                setTimeLeft(duration * 60);

                setLoading(false);
            } catch (error: any) {
                console.error("Exam start failed", error);
                setError(error.response?.data?.error || "Failed to initialize exam. Please check your connection.");
                setLoading(false);
            }
        };
        fetchInfo();
    }, [examId, navigate]);

    // Timer logic
    useEffect(() => {
        if (!hasStarted || timeLeft <= 0 || isFinished) return;
        const timer = setInterval(() => {
            setTimeLeft(prev => prev - 1);
        }, 1000);
        return () => clearInterval(timer);
    }, [hasStarted, timeLeft, isFinished]);

    // Auto-submit when timer hits zero
    useEffect(() => {
        if (hasStarted && timeLeft <= 0 && !isFinished) {
            submitFinal();
        }
    }, [hasStarted, timeLeft, isFinished]);

    const handleStartExam = () => {
        const elem = document.documentElement;
        if (elem.requestFullscreen) {
            elem.requestFullscreen().catch((err) => console.log("Fullscreen blocked", err));
        }
        setHasStarted(true);
    };

    const handleAnswer = async (questionId: string, optionId: number) => {
        const updatedAnswers = { ...answers, [questionId]: optionId };
        setAnswers(updatedAnswers);

        // Background sync
        try {
            await api.post(`/student/exams/${attemptId}/sync`, {
                answers: [{ question_id: questionId, selected_option_id: optionId }]
            });
        } catch (e) {
            console.error("Auto-sync failed", e);
        }
    };

    const submitFinal = async () => {
        try {
            setLoading(true);

            // 1. Format answers for the sync endpoint
            const formattedAnswers = Object.entries(answers).map(([qId, oId]) => ({
                question_id: qId,
                selected_option_id: oId
            }));

            // 2. Sync final answers
            await api.post(`/student/exams/${attemptId}/sync`, { answers: formattedAnswers });

            // 3. Submit the exam
            const submitRes = await api.post(`/student/exams/${attemptId}/submit`);

            // Exit fullscreen
            if (document.fullscreenElement) {
                try {
                    await document.exitFullscreen();
                } catch (e) {
                    console.log("Error exiting fullscreen", e);
                }
            }

            setFinalScore(submitRes.data.score);
            setIsFinished(true);
            setLoading(false);
        } catch (error: any) {
            console.error("Submission error:", error);
            setLoading(false);
        }
    };

    const handleSubmit = async () => {
        if (!confirm("Are you sure you want to finalize and submit your answers?")) return;
        await submitFinal();
    };

    if (loading) return <div className="h-screen flex items-center justify-center bg-white"><Loader2 className="animate-spin text-primary-600" size={48} /></div>;

    if (error) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                <div className="bg-white max-w-md w-full p-10 rounded-[40px] shadow-2xl border border-slate-100 text-center">
                    <div className="w-20 h-20 bg-red-50 text-red-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
                        <AlertCircle size={40} />
                    </div>
                    <h1 className="text-2xl font-black text-slate-900 mb-4">Exam Unavailable</h1>
                    <p className="text-slate-500 mb-8 font-medium leading-relaxed">{error}</p>
                    <button
                        onClick={() => navigate('/student/dashboard')}
                        className="w-full bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold py-4 rounded-2xl transition-all active:scale-95"
                    >
                        Return to Dashboard
                    </button>
                    <p className="text-[10px] text-slate-400 mt-6 font-bold uppercase tracking-widest leading-relaxed">
                        Tip: This usually happens if there aren't enough questions in the chosen unit/difficulty.
                    </p>
                </div>
            </div>
        );
    }

    // Result Screen
    if (isFinished) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                <div className="bg-white max-w-md w-full p-10 rounded-[40px] shadow-2xl border border-slate-100 text-center animate-in zoom-in duration-500">
                    <div className="w-24 h-24 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
                        <CheckCircle2 size={48} />
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 mb-2">Session Completed</h1>
                    <p className="text-slate-500 mb-10 font-medium">Your answers have been securely synced and graded.</p>

                    <div className="bg-slate-50 rounded-3xl p-8 mb-10 border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Final Correct Answers</p>
                        <p className="text-6xl font-black text-slate-900 leading-none">
                            {finalScore}<span className="text-2xl text-slate-300 ml-2">/ {questions.length}</span>
                        </p>
                    </div>

                    <button
                        onClick={() => navigate('/student/dashboard')}
                        className="w-full bg-slate-900 hover:bg-black text-white font-black py-4 rounded-2xl transition-all shadow-xl active:scale-95 flex items-center justify-center gap-2"
                    >
                        Return to Dashboard
                    </button>

                    <p className="text-[10px] text-slate-400 mt-8 font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                        <Clock size={12} /> Sync Timestamp: {new Date().toLocaleTimeString()}
                    </p>
                </div>
            </div>
        );
    }

    // Gate / Introduction Screen
    if (!hasStarted) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                <div className="bg-white max-w-2xl w-full p-8 rounded-3xl shadow-xl border border-slate-100 text-center animate-in zoom-in duration-300">
                    <div className="w-20 h-20 bg-primary-50 text-primary-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
                        <Play size={40} className="ml-1" />
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 mb-2">Ready to Start?</h1>
                    <p className="text-slate-500 mb-8 font-medium">Please review these instructions carefully before beginning the session.</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left mb-8">
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-start gap-3">
                            <Clock className="text-primary-600 mt-1" size={18} />
                            <div>
                                <p className="font-bold text-slate-900 text-sm">Strict Timing</p>
                                <p className="text-slate-500 text-xs">The timer will start as soon as you click the button below.</p>
                            </div>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-start gap-3">
                            <AlertCircle className="text-orange-600 mt-1" size={18} />
                            <div>
                                <p className="font-bold text-slate-900 text-sm">Focus Mode</p>
                                <p className="text-slate-500 text-xs">The session will enter Fullscreen mode. Avoid switching tabs.</p>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleStartExam}
                        className="w-full bg-primary-600 hover:bg-primary-700 text-white font-black py-4 rounded-2xl shadow-lg shadow-primary-200 transition-all flex items-center justify-center gap-2 text-lg active:scale-95"
                    >
                        <CheckCircle2 size={24} />
                        Enter Session Now
                    </button>
                </div>
            </div>
        );
    }

    const currentQuestion = questions[currentQuestionIndex];

    return (
        <div className="h-screen flex flex-col bg-white">
            {/* Top Bar */}
            <header className="h-20 border-b border-slate-100 flex items-center justify-between px-8 bg-white/80 backdrop-blur-md sticky top-0 z-30">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center font-bold">Q</div>
                    <div>
                        <h1 className="font-black text-slate-900 leading-tight">Exam Portal</h1>
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest leading-none">Live Session Active</p>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3 bg-red-50 px-4 py-2 rounded-xl border border-red-100">
                        <Clock className="text-red-600 animate-pulse" size={20} />
                        <span className="text-xl font-mono font-black text-red-700">
                            {Math.floor(timeLeft / 60).toString().padStart(2, '0')}:{(timeLeft % 60).toString().padStart(2, '0')}
                        </span>
                    </div>
                    <button
                        onClick={handleSubmit}
                        className="bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-green-100 transition-all active:scale-95"
                    >
                        Submit Final
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Question Area */}
                <main className="flex-1 p-8 lg:p-12 overflow-y-auto bg-slate-50/50">
                    {currentQuestion ? (
                        <div className="max-w-4xl mx-auto">
                            <div className="mb-10">
                                <span className="bg-primary-50 text-primary-600 px-3 py-1 rounded-lg text-xs font-black uppercase tracking-widest">
                                    Section {currentQuestion.subject_id?.split('-')[0] || 1}
                                </span>
                                <h2 className="text-3xl font-bold text-slate-900 mt-4 leading-tight">
                                    {currentQuestion.text}
                                </h2>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                {currentQuestion.options && currentQuestion.options.map((option: any) => (
                                    <button
                                        key={`${currentQuestion.id}-${option.id}`}
                                        onClick={() => handleAnswer(currentQuestion.id, option.id)}
                                        className={cn(
                                            "w-full text-left p-6 rounded-2xl border-2 transition-all flex items-center group relative overflow-hidden",
                                            answers[currentQuestion.id] === option.id
                                                ? "border-primary-600 bg-primary-50/50 text-primary-900 shadow-md"
                                                : "border-white bg-white hover:border-primary-100 hover:shadow-md text-slate-600"
                                        )}
                                    >
                                        <div className={cn(
                                            "w-8 h-8 rounded-lg border-2 flex items-center justify-center mr-5 text-sm font-black transition-colors",
                                            answers[currentQuestion.id] === option.id
                                                ? "border-primary-600 bg-primary-600 text-white"
                                                : "border-slate-100 bg-slate-50 group-hover:border-primary-300"
                                        )}>
                                            {String.fromCharCode(64 + option.id)}
                                        </div>
                                        <span className="text-lg font-medium">{option.text}</span>
                                    </button>
                                ))}
                            </div>

                            <div className="flex justify-between items-center mt-12 pt-8 border-t border-slate-200">
                                <button
                                    onClick={() => setCurrentQuestionIndex(p => Math.max(0, p - 1))}
                                    disabled={currentQuestionIndex === 0}
                                    className="px-6 py-3 rounded-xl font-bold text-slate-500 hover:bg-white hover:shadow-sm disabled:opacity-20 flex items-center gap-2 transition-all"
                                >
                                    <ChevronLeft size={24} /> Previous
                                </button>
                                <div className="text-slate-400 font-bold text-sm">
                                    Page {currentQuestionIndex + 1} of {questions.length}
                                </div>
                                <button
                                    onClick={() => setCurrentQuestionIndex(p => Math.min(questions.length - 1, p + 1))}
                                    disabled={currentQuestionIndex === questions.length - 1}
                                    className="px-8 py-3 rounded-xl font-black bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-20 flex items-center gap-2 transition-all shadow-lg active:scale-95"
                                >
                                    Next <ChevronRight size={24} />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                            <AlertCircle size={48} className="mb-4" />
                            <p className="font-bold">No question data found.</p>
                        </div>
                    )}
                </main>

                {/* Sidebar Palette */}
                <aside className="w-96 border-l border-slate-100 bg-white p-8 overflow-y-auto hidden xl:block">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Question Palette</h3>
                    <div className="grid grid-cols-5 gap-3">
                        {questions.map((q, idx) => (
                            <button
                                key={`palette-${q.id}-${idx}`}
                                onClick={() => setCurrentQuestionIndex(idx)}
                                className={cn(
                                    "w-12 h-12 rounded-xl text-sm font-black flex items-center justify-center transition-all relative",
                                    currentQuestionIndex === idx
                                        ? "ring-4 ring-primary-100 border-2 border-primary-600"
                                        : "border-2 border-transparent",
                                    answers[q.id]
                                        ? "bg-primary-600 text-white shadow-lg shadow-primary-100"
                                        : "bg-slate-50 text-slate-400 hover:bg-slate-100"
                                )}
                            >
                                {idx + 1}
                            </button>
                        ))}
                    </div>

                    <div className="mt-12 p-6 bg-slate-50 rounded-2xl space-y-4">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Legend</p>
                        <div className="flex items-center gap-3 text-sm font-bold text-slate-600">
                            <div className="w-5 h-5 bg-primary-600 rounded-lg shadow-sm" />
                            <span>Answered</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm font-bold text-slate-600">
                            <div className="w-5 h-5 bg-slate-200 rounded-lg" />
                            <span>Unanswered</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm font-bold text-slate-600">
                            <div className="w-5 h-5 border-2 border-primary-600 rounded-lg" />
                            <span>Current</span>
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    );
}
