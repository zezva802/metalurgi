// Temporary page body until the real screen is built.
export function Placeholder({ title, who, task }: { title: string; who: string; task: string }) {
  return (
    <div className="space-y-3">
      <h1 className="text-4xl font-bold text-slate-900">{title}</h1>
      <p className="text-xl text-slate-600">{who}</p>
      <p className="text-lg text-slate-400">Coming in {task}.</p>
    </div>
  );
}
