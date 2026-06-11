import { DecorativeBlobs } from "./DecorativeBlobs";

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
}

export function PageHeader({ title, description, children }: PageHeaderProps) {
  return (
    <div className="relative bg-brand-navy text-white overflow-hidden">
      <DecorativeBlobs />
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="font-display text-3xl sm:text-4xl font-bold mb-3">{title}</h1>
        {description && (
          <p className="text-brand-light/80 text-lg max-w-2xl">{description}</p>
        )}
        {children}
      </div>
    </div>
  );
}
