import React from 'react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface EntityHeaderProps {
  breadcrumbs?: BreadcrumbItem[];
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
}

export const EntityHeader: React.FC<EntityHeaderProps> = ({
  breadcrumbs,
  title,
  subtitle,
  badge,
  actions,
}) => {
  return (
    <div className="flex flex-col gap-2 pb-6 border-b border-gray-100">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1.5 text-xs text-[#656C79]">
          {breadcrumbs.map((item, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <span>›</span>}
              {item.href ? (
                <a href={item.href} className="hover:text-[#082051] transition-colors">
                  {item.label}
                </a>
              ) : (
                <span className="text-[#082051] font-medium">{item.label}</span>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-[#082051]">{title}</h1>
          {badge}
        </div>
        {actions && <div className="flex items-center gap-2.5">{actions}</div>}
      </div>
      {subtitle && <p className="text-sm text-[#656C79] max-w-3xl">{subtitle}</p>}
    </div>
  );
};
