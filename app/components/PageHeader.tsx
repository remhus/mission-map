'use client';

// Unified page header: white title, optional accent eyebrow, optional subtitle,
// actions slot on the right. Keeps every page speaking with one voice.
export default function PageHeader({ eyebrow, title, subtitle, children }: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between mb-6 gap-3">
      <div>
        {eyebrow && (
          <p className="text-xs font-bold tracking-widest uppercase mb-1 text-accent">{eyebrow}</p>
        )}
        <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white" style={{ fontFamily: 'var(--font-jakarta)' }}>
          {title}
        </h1>
        {subtitle && <p className="text-sm mt-1 max-w-xl leading-relaxed text-muted">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-2 flex-shrink-0">{children}</div>}
    </div>
  );
}
