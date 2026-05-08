const STYLES = {
  success: { bar: 'bg-accent',      icon: '✓', iconCls: 'bg-accent text-bg' },
  error:   { bar: 'bg-red-500',     icon: '✕', iconCls: 'bg-red-500 text-white' },
  warning: { bar: 'bg-yellow-500',  icon: '!', iconCls: 'bg-yellow-500 text-bg' },
  info:    { bar: 'bg-blue-500',    icon: 'i', iconCls: 'bg-blue-500 text-white' },
};

export default function Toast({ message, type = 'success' }) {
  const s = STYLES[type] || STYLES.success;
  return (
    <div className="flex items-center gap-3 pl-1 pr-4 py-2.5 bg-surface border border-surface-light rounded-lg shadow-2xl text-sm animate-fade-up min-w-[240px] overflow-hidden relative">
      {/* left accent bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${s.bar} rounded-l-lg`} />

      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ml-2 ${s.iconCls}`}>
        {s.icon}
      </span>
      <span className="text-gray-200">{message}</span>
    </div>
  );
}
