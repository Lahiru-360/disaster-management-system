const CHANNEL_LABELS = {
  PUSH: 'Push notification',
  SMS: 'SMS gateway',
  AUDIBLE: 'Audible alert',
};

// The channel rows of the preview panel (UC01 §5.1): each channel the
// warning goes out on, and whether it is ready. `channels` is the preview's
// [{ channel, ready }].
export default function ChannelReadiness({ channels }) {
  return (
    <ul className="divide-y divide-line">
      {channels.map(({ channel, ready }) => (
        <li key={channel} className="flex items-center justify-between py-2 text-[14px]">
          <span className="text-ink">{CHANNEL_LABELS[channel] ?? channel}</span>
          <span
            className={['font-semibold', ready ? 'text-success-ink' : 'text-danger-ink'].join(' ')}
          >
            {ready ? 'Ready' : 'Not ready'}
          </span>
        </li>
      ))}
    </ul>
  );
}
