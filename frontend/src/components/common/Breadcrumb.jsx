import React from 'react';
import { ChevronRight } from 'lucide-react';
import './Breadcrumb.css';

const Breadcrumb = ({ items = [], separator = '>' }) => {
  const parsed = items.map((item) => {
    if (typeof item === 'string') {
      return { label: item, href: null };
    }
    return { label: item.label || item.text || '', href: item.href || null };
  });

  if (parsed.length === 0) return null;

  return (
    <nav className="breadcrumb-nav" aria-label="breadcrumb">
      <ol className="breadcrumb-list">
        {parsed.map((item, idx) => {
          const isLast = idx === parsed.length - 1;
          return (
            <li key={idx} className="breadcrumb-item">
              {item.href && !isLast ? (
                <a href={item.href} className="breadcrumb-link">
                  {item.label}
                </a>
              ) : (
                <span className={`breadcrumb-text${isLast ? ' active' : ''}`}>
                  {item.label}
                </span>
              )}
              {!isLast && (
                <span className="breadcrumb-separator" aria-hidden="true">
                  {separator}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default Breadcrumb;
