import type { ReactNode } from "react";
import { Switch } from "./switch.js";

export function SettingRow({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
  badge,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  badge?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <div className="flex items-center gap-2 font-medium">
          {label}
          {badge}
        </div>
        {description && <div className="mt-0.5 text-sm text-muted-foreground">{description}</div>}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  );
}
