import { Inbox } from "lucide-react";

export default function EmptyState({ icon: Icon = Inbox, title, description }) {
  return (
    <div className="animate-fade-in-up flex flex-col items-center justify-center gap-3 rounded-[2rem] border border-dashed border-white/10 bg-white/[0.02] px-8 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-white/30">
        <Icon size={22} />
      </div>

      <p className="font-black text-white/70">{title}</p>

      {description && (
        <p className="max-w-sm text-sm text-white/40">{description}</p>
      )}
    </div>
  );
}
