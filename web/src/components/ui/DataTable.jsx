import EmptyState from './EmptyState';

const DEFAULT_ROW_KEY = (row, index) => row.id ?? index;

// `columns`: [{ key, header, render?(row) }] - render defaults to row[key].
// Selection is controlled: pass `selectedKeys` (a Set) and `onSelectionChange`
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
  className,
  ...props
}) {
  if (rows.length === 0) {
    return emptyState ?? <EmptyState title="Nothing to show yet" />;
  }

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
      <table className="w-full text-left text-[14px]">
        <thead className="bg-haze text-[12px] font-semibold text-muted uppercase">
          <tr>
            {selectable ? (
              <th scope="col" className="w-10 px-4 py-3">
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
              <th key={column.key} scope="col" className="px-4 py-3">
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
                  <td className="w-10 px-4 py-3" onClick={(event) => event.stopPropagation()}>
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
                  <td key={column.key} className="px-4 py-3">
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
