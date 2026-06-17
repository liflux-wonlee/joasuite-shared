import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Bell, Check } from "lucide-react";
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/lib/notifications.functions";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

export function NotificationsBell() {
  const { t } = useTranslation();
  const { currentTenantId } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const fetchList = useServerFn(listNotifications);
  const markRead = useServerFn(markNotificationRead);
  const markAll = useServerFn(markAllNotificationsRead);

  const { data } = useQuery({
    queryKey: ["notifications", currentTenantId],
    enabled: !!currentTenantId,
    queryFn: () => fetchList({ data: { tenant_id: currentTenantId!, limit: 30 } }),
    refetchInterval: 30_000,
  });

  const unread = data?.unread_count ?? 0;
  const rows = data?.rows ?? [];

  const handleClick = async (n: { id: string; link_path: string | null; read_at: string | null }) => {
    if (!n.read_at) {
      try { await markRead({ data: { id: n.id } }); } catch {}
      qc.invalidateQueries({ queryKey: ["notifications", currentTenantId] });
    }
    setOpen(false);
    if (n.link_path) nav({ to: n.link_path as string });
  };

  const handleMarkAll = async () => {
    if (!currentTenantId) return;
    try { await markAll({ data: { tenant_id: currentTenantId } }); } catch {}
    qc.invalidateQueries({ queryKey: ["notifications", currentTenantId] });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative inline-flex items-center justify-center w-9 h-9 rounded hover:bg-sidebar-accent text-sidebar-foreground"
          aria-label={String(t("bell.aria"))}
        >
          <Bell className="w-4 h-4" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-medium flex items-center justify-center">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <div className="text-sm font-medium">{t("bell.title")}</div>
          {unread > 0 && (
            <Button variant="ghost" size="sm" onClick={handleMarkAll} className="h-7 text-xs">
              <Check className="w-3 h-3 mr-1" /> {t("bell.mark_all_read")}
            </Button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {rows.length === 0 && (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">{t("bell.no_notifications")}</div>
          )}
          {rows.map((n: any) => (
            <button
              key={n.id}
              onClick={() => handleClick(n)}
              className={`w-full text-left px-3 py-2.5 border-b last:border-b-0 hover:bg-muted/40 transition-colors ${
                !n.read_at ? "bg-primary/5" : ""
              }`}
            >
              <div className="flex items-start gap-2">
                {!n.read_at && <span className="mt-1.5 w-2 h-2 rounded-full bg-primary shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="text-sm font-medium truncate">{n.title || n.kind}</div>
                    <div className="text-[10px] text-muted-foreground shrink-0">{timeAgo(n.created_at)}</div>
                  </div>
                  {n.body && <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</div>}
                </div>
              </div>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
