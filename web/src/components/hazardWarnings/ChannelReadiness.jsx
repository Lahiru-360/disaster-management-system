import { Bell, MessageSquare, Volume2 } from 'lucide-react';

const CHANNELS = {
  PUSH: { label: 'Push notification', Icon: Bell },
  SMS: { label: 'SMS gateway', Icon: MessageSquare },
  AUDIBLE: { label: 'Audible alert', Icon: Volume2 },
};

// The channel rows of the preview panel (UC01 §5.1): each channel the
// warning goes out on, and whether it is ready. `channels` is the preview's
// [{ channel, ready }]. Drawn for the dark (navy) preview panel.
export default function ChannelReadiness({ channels }) {
  return (
    <ul className="space-y-2.5">
      {channels.map(({ channel, ready }) => {
        const { label, Icon } = CHANNELS[channel] ?? { label: channel, Icon: Bell };

        return (
          <li
            key={channel}
            className="flex items-center gap-3 rounded-lg bg-navy-hi px-4 py-3 text-[14px]"
          >
            <Icon size={17} strokeWidth={1.75} className="text-muted-dark" aria-hidden="true" />
            <span className="flex-1 text-paper">{label}</span>
            <span className={['font-bold', ready ? 'text-paper' : 'text-danger'].join(' ')}>
              {ready ? 'Ready' : 'Not ready'}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
