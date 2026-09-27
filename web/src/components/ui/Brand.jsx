import { APP_NAME } from '../../constants/config';

// The brand mark and APP_NAME wordmark, for a navy background.
export default function Brand({ className, ...props }) {
  return (
    <div className={['flex items-center gap-2.5', className].filter(Boolean).join(' ')} {...props}>
      <div
        aria-hidden="true"
        className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-paper"
      >
        <div className="flex items-end">
          <div className="h-[13px] w-[3px] rounded-[2px] bg-navy" />
          <div className="ml-[3px] h-[8px] w-[3px] rounded-[2px] bg-navy opacity-55" />
        </div>
      </div>
      <span className="text-base font-bold tracking-[-0.02em] text-paper">{APP_NAME}</span>
    </div>
  );
}
