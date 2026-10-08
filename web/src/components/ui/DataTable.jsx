import EmptyState from './EmptyState';

const DEFAULT_ROW_KEY = (row, index) => row.id ?? index;

// `columns`: [{ key, header, render?(row) }] - render defaults to row[key].
// `dense` tightens the cells and keeps the header in view while the table
// scrolls inside a fixed height (a dashboard panel). Selection is controlled: pass `selectedKeys` (a Set) and `onSelectionChange`
// together, or omit both to render without checkboxes.
export default function DataTable({
  columns = [],
  rows = [],
  rowKey = DEFAULT_ROW_KEY,
  selectable = false,
  selectedKeys,
  onSelectionChange,
  onRowClick,
  emptyState,
  dense = false,
  className,
  ...props
}) {
  if (rows.length === 0) {
    return emptyState ?? <EmptyState title="Nothing to show yet" />;
  }

  const cell = dense ? 'px-3 py-1.5 whitespace-nowrap' : 'px-4 py-3';
  const keys = rows.map((row, index) => rowKey(row, index));
  const selected = selectedKeys ?? new Set();
  const allSelected = keys.every((key) => selected.has(key));

  const toggleAll = () => {
    onSelectionChange?.(allSelected ? new Set() : new Set(keys));
  };

  const toggleRow = (key) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onSelectionChange?.(next);
  };

  return (
    <div
      className={['overflow-x-auto rounded-xl border border-line', className]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      <table className={['w-full text-left', dense ? 'text-[13px]' : 'text-[14px]'].join(' ')}>
        <thead
          className={[
            'bg-haze font-semibold text-muted',
            dense ? 'sticky top-0 z-10 text-[12px]' : 'text-[12px] uppercase',
          ].join(' ')}
        >
          <tr>
            {selectable ? (
              <th scope="col" className={['w-10', cell].join(' ')}>
                <input
                  type="checkbox"
                  aria-label="Select all rows"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="h-4 w-4 rounded border-line accent-navy"
                />
              </th>
            ) : null}
            {columns.map((column) => (
              <th key={column.key} scope="col" className={cell}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row, index) => {
            const key = keys[index];
            const isSelected = selected.has(key);

            return (
              <tr
                key={key}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={[
                  'text-ink',
                  onRowClick && 'cursor-pointer hover:bg-navy-soft',
                  isSelected && 'bg-navy-soft',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {selectable ? (
                  <td
                    className={['w-10', cell].join(' ')}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      aria-label="Select row"
                      checked={isSelected}
                      onChange={() => toggleRow(key)}
                      className="h-4 w-4 rounded border-line accent-navy"
                    />
                  </td>
                ) : null}
                {columns.map((column) => (
                  <td key={column.key} className={cell}>
                    {column.render ? column.render(row) : row[column.key]}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
