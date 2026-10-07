// The Priority enum (docs/api-contract.md §13.2) in the order the Dispatch
// Rescue Team dialog lists it, with the labels it shows.
export const PRIORITIES = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'CRITICAL', label: 'Critical' },
];

// A new dispatch starts at HIGH.
export const DEFAULT_PRIORITY = 'HIGH';
