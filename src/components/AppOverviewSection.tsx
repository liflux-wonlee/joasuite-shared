import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { AlertCircle, LayoutGrid } from "lucide-react";
import { useJoaSuite } from "../context";
import type { AppSummaryTile } from "../types";

/**
 * "App Overview" section for JoaSuite Home — one tile per app that has
 * implemented the `AppSummaryTile` contract (see types.ts). Apps that
 * haven't implemented it yet simply don't produce a tile; there is no
 * placeholder per-app row here, since the core has no way to know an app
 * exists until it starts returning a tile.
 */
export function AppOverviewSection({ tenantIds }: { tenantIds: string[] }) {
  const { t } = useTranslation();
  const { ui, router, fns } = useJoaSuite();
  const { Card, Badge } = ui;
  const { Link } = router;

  const q = useQuery({
    queryKey: ["app-overview", tenantIds],
    enabled: tenantIds.length > 0,
    queryFn: () => fns.getAppSummaries({ tenantIds }),
  });

  const tiles: AppSummaryTile[] = q.data ?? [];

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-3">
        <LayoutGrid className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {t("suite.app_overview.title", "App Overview")}
        </h2>
      </div>
      {q.isLoading ? (
        <div className="text-sm text-muted-foreground">{t("common.loading")}</div>
      ) : tiles.length === 0 ? (
        <div className="text-sm text-muted-foreground py-4 text-center">
          {t("suite.app_overview.empty", "No connected app summaries yet.")}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {tiles.map((tile) => (
            <Link
              key={tile.app_code}
              to={tile.link_path as any}
              className="border rounded-lg p-4 hover:border-primary transition block"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium uppercase text-muted-foreground">
                  {tile.app_code}
                </span>
                {!!tile.alert_count && (
                  <Badge variant="outline" className="gap-1 text-[10px]">
                    <AlertCircle className="h-3 w-3" />
                    {tile.alert_count}
                  </Badge>
                )}
              </div>
              <div className="mt-2">
                <div className="text-xs text-muted-foreground">{tile.headline_label}</div>
                <div className="text-xl font-semibold mt-0.5">{tile.headline_value}</div>
              </div>
              {tile.secondary.length > 0 && (
                <div className="mt-3 space-y-1">
                  {tile.secondary.map((s) => (
                    <div key={s.label} className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{s.label}</span>
                      <span className="tabular-nums text-foreground">{s.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}
