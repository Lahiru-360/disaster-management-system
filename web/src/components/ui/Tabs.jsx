import { useRef } from 'react';

// `tabs`: [{ key, label }]. Presentational only - the caller owns which
// panel is rendered for `value`. Arrow/Home/End keys move both focus and
// selection, per the standard ARIA tabs pattern.
export default function Tabs({ tabs, value, onChange, className, ...props }) {
  const tabRefs = useRef([]);

  const focusTabAt = (index) => tabRefs.current[index]?.focus();

  const handleKeyDown = (event, index) => {
    const lastIndex = tabs.length - 1;
    let nextIndex;

    if (event.key === 'ArrowRight') nextIndex = index === lastIndex ? 0 : index + 1;
    else if (event.key === 'ArrowLeft') nextIndex = index === 0 ? lastIndex : index - 1;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = lastIndex;
    else return;

    event.preventDefault();
    onChange(tabs[nextIndex].key);
    focusTabAt(nextIndex);
  };

  return (
    <div
      role="tablist"
      className={['flex gap-1 border-b border-line', className].filter(Boolean).join(' ')}
      {...props}
    >
      {tabs.map((tab, index) => {
        const isActive = tab.key === value;

        return (
          <button
            key={tab.key}
            ref={(el) => {
              tabRefs.current[index] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${tab.key}`}
            aria-selected={isActive}
            aria-controls={`tabpanel-${tab.key}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab.key)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={[
              '-mb-px border-b-2 px-4 py-2.5 text-[14px] font-semibold transition-colors',
              'focus-visible:ring-2 focus-visible:ring-navy-soft focus-visible:outline-none',
              isActive
                ? 'border-navy text-navy'
                : 'border-transparent text-muted hover:text-ink',
            ].join(' ')}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
