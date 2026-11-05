import { RotateCcw, AlertCircle } from 'lucide-react';

/** Полноэкранный спиннер загрузки. */
export function PageLoading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

/** Экран ошибки с кнопкой повтора. */
export function PageError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] px-6 text-center gap-4">
      <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center">
        <AlertCircle size={28} className="text-red-400" />
      </div>
      <div>
        <p className="text-sm font-medium text-white/70">Не удалось загрузить</p>
        <p className="text-xs text-white/40 mt-1">{message}</p>
      </div>
      <button
        onClick={onRetry}
        className="px-5 py-2.5 rounded-2xl bg-violet-500/15 text-violet-400 text-sm font-medium flex items-center gap-2 active:scale-95 transition-transform"
      >
        <RotateCcw size={16} /> Повторить
      </button>
    </div>
  );
}
