import { CreditCard, Rocket, CheckCircle2, ShieldCheck } from 'lucide-react';

export default function PaymentPending() {
    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100">
                {/* Information Side */}
                <div className="p-12 bg-primary-600 text-white flex flex-col justify-center">
                    <Rocket size={48} className="mb-6 text-primary-200" />
                    <h1 className="text-3xl font-bold mb-4">Activate Your School Portal</h1>
                    <p className="text-primary-100 mb-8">
                        To continue using the School Exam PWA and unlock all premium features, please complete your subscription setup.
                    </p>

                    <ul className="space-y-4">
                        <li className="flex items-center gap-3 text-sm">
                            <CheckCircle2 size={18} className="text-primary-300" />
                            Unlimited Question Bank Uploads
                        </li>
                        <li className="flex items-center gap-3 text-sm">
                            <CheckCircle2 size={18} className="text-primary-300" />
                            AI-Powered Exam Generation
                        </li>
                        <li className="flex items-center gap-3 text-sm">
                            <CheckCircle2 size={18} className="text-primary-300" />
                            Real-time Student Monitoring
                        </li>
                        <li className="flex items-center gap-3 text-sm">
                            <CheckCircle2 size={18} className="text-primary-300" />
                            Detailed Analytics & Results
                        </li>
                    </ul>

                    <div className="mt-12 flex items-center gap-3 p-4 bg-primary-700/50 rounded-2xl border border-primary-500/30">
                        <ShieldCheck size={24} className="text-primary-300" />
                        <span className="text-xs text-primary-100">Secure 256-bit encrypted payment processing</span>
                    </div>
                </div>

                {/* Pricing / CTA Side */}
                <div className="p-12 flex flex-col justify-center items-center text-center">
                    <div className="inline-block px-4 py-1.5 bg-green-50 text-green-700 rounded-full text-xs font-bold uppercase tracking-wider mb-6">
                        Limited Time Offer
                    </div>
                    <h2 className="text-4xl font-black text-slate-900 mb-2">$49<span className="text-lg text-slate-400 font-normal">/month</span></h2>
                    <p className="text-slate-500 text-sm mb-10">All-in-one platform for your school</p>

                    <button className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-primary-200 transition-all hover:-translate-y-1 flex items-center justify-center gap-3 mb-4">
                        <CreditCard size={20} />
                        Complete Payment Now
                    </button>

                    <button className="text-slate-400 hover:text-slate-600 text-sm font-medium transition" onClick={() => window.location.href = '/login'}>
                        Sign out and return later
                    </button>

                    <div className="mt-12 pt-12 border-t border-slate-100 w-full text-center">
                        <p className="text-xs text-slate-400">Need help? Contact support at <span className="text-primary-600 font-medium cursor-pointer underline">billing@schoolexampwa.com</span></p>
                    </div>
                </div>
            </div>
        </div>
    );
}
