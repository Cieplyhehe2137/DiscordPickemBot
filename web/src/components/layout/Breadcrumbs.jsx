import { Link } from "react-router-dom";

export default function Breadcrumbs({ items = [] }) {
  return (
    <div className="mb-8 flex flex-wrap items-center gap-3 text-sm">
      {items.map((item, index) => (
        <div key={item.label} className="flex items-center gap-3">
          {index > 0 && <span className="text-white/20">/</span>}

          {item.to ? (
            <Link
              to={item.to}
              className="font-bold text-white/50 transition hover:text-white"
            >
              {item.label}
            </Link>
          ) : (
            <span className="font-black text-white">{item.label}</span>
          )}
        </div>
      ))}
    </div>
  );
}
