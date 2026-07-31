import { Lock } from "lucide-react";

export default function LockScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
      <div className="bg-white rounded-2xl shadow-xl p-10 max-w-md text-center">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-5">
          <Lock size={30} className="text-sbred" />
        </div>
        <h1 className="text-xl font-extrabold text-slate-900 mb-2">Aplicativo bloqueado</h1>
        <p className="text-slate-600 leading-relaxed">
          Entre em contato com o administrador,<br />
          <span className="font-bold text-slate-900">Pablo Lima — 13 991560814</span>
        </p>
      </div>
    </div>
  );
}
