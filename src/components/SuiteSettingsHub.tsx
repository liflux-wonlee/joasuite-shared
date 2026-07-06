import { useTranslation } from "react-i18next";
import {
  Building2,
  Users,
  Shield,
  AppWindow,
  ExternalLink,
  Contact2,
  Briefcase,
  Bell,
  ScrollText,
  ArrowRight,
} from "lucide-react";
import { useJoaSuite } from "../context";

type Tile = {
  to?: string;
  icon: any;
  label: string;
  description: string;
  disabled?: boolean;
  badge?: string;
};

export function SuiteSettingsHub() {
  const { t } = useTranslation();
  const { ui, router } = useJoaSuite();
  const { Link } = router;
  const { Card, Badge } = ui;

  const orgTiles: Tile[] = [
    {
      to: "/app/settings/general",
      icon: Building2,
      label: t("suite.tile.company", "Company / Tenant Profile"),
      description: t(
        "suite.tile.company_desc",
        "Workspace name, locale, branding, defaults.",
      ),
    },
    {
      to: "/app/people",
      icon: Users,
      label: t("suite.tile.people", "People"),
      description: t(
        "suite.tile.people_desc",
        "Invite people across all organizations and assign per-app roles.",
      ),
    },
    {
      to: "/app/settings/organizations",
      icon: Shield,
      label: t("suite.tile.org_units", "Departments"),
      description: t(
        "suite.tile.org_units_desc",
        "Org chart, departments, hierarchy.",
      ),
    },
    {
      icon: Briefcase,
      label: t("suite.tile.positions", "Positions"),
      description: t(
        "suite.tile.positions_desc",
        "Job titles and positions. Available via API; UI coming soon.",
      ),
      disabled: true,
      badge: t("suite.state.coming_soon", "Coming Soon"),
    },
    {
      icon: Contact2,
      label: t("suite.tile.directory", "Directory"),
      description: t(
        "suite.tile.directory_desc",
        "Directory will provide shared access to customers, vendors, employees, contractors, and contacts across JoaSuite apps.",
      ),
      disabled: true,
      badge: t("suite.state.coming_soon", "Coming Soon"),
    },
  ];

  const appsTiles: Tile[] = [
    {
      to: "/app/suite",
      icon: AppWindow,
      label: t("suite.tile.app_access", "App Access"),
      description: t(
        "suite.tile.app_access_desc",
        "Enable / cancel subscriptions in app_catalog & tenant_apps.",
      ),
    },
    {
      to: "/app/suite",
      icon: ExternalLink,
      label: t("suite.tile.app_urls", "App URLs"),
      description: t(
        "suite.tile.app_urls_desc",
        "Per-tenant external URLs for JoaApproval, JoaCRM, JoaOffice, JoaSOP.",
      ),
    },
  ];

  const activityTiles: Tile[] = [
    {
      to: "/app/notifications",
      icon: Bell,
      label: t("suite.tile.notifications", "Notifications"),
      description: t(
        "suite.tile.notifications_desc",
        "All cross-app notifications for the current workspace.",
      ),
    },
    {
      to: "/app/audit-logs",
      icon: ScrollText,
      label: t("suite.tile.audit_logs", "Audit Logs"),
      description: t(
        "suite.tile.audit_logs_desc",
        "Tenant-scoped audit trail across JoaSuite apps.",
      ),
    },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("suite.settings.title", "Suite Settings")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t(
              "suite.settings.subtitle",
              "Workspace-wide settings shared across all JoaSuite apps. App-specific settings live inside each app.",
            )}
          </p>
        </div>
        <Link
          to="/app/suite"
          className="text-xs text-primary hover:underline flex items-center gap-1"
        >
          {t("suite.back_home", "Back to JoaSuite Home")}{" "}
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <Section title={t("suite.section.org", "Organization")} tiles={orgTiles} Link={Link} Card={Card} Badge={Badge} />
      <Section title={t("suite.section.apps", "Apps")} tiles={appsTiles} Link={Link} Card={Card} Badge={Badge} />
      <Section
        title={t("suite.section.activity", "Activity & Monitoring")}
        tiles={activityTiles}
        Link={Link}
        Card={Card}
        Badge={Badge}
      />
    </div>
  );
}

function Section({
  title,
  tiles,
  Link,
  Card,
  Badge,
}: {
  title: string;
  tiles: Tile[];
  Link: any;
  Card: any;
  Badge: any;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {tiles.map((tile) => (
          <TileCard key={tile.label} tile={tile} Link={Link} Card={Card} Badge={Badge} />
        ))}
      </div>
    </section>
  );
}

function TileCard({ tile, Link, Card, Badge }: { tile: Tile; Link: any; Card: any; Badge: any }) {
  const Icon = tile.icon;
  const inner = (
    <Card
      className={`p-4 h-full flex flex-col gap-2 transition-colors ${
        tile.disabled ? "opacity-60" : "hover:bg-muted/50 cursor-pointer"
      }`}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium text-sm">{tile.label}</span>
        {tile.badge && (
          <Badge variant="outline" className="ml-auto text-[10px]">
            {tile.badge}
          </Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{tile.description}</p>
    </Card>
  );
  if (tile.disabled || !tile.to) return inner;
  return (
    <Link to={tile.to as any} className="block h-full">
      {inner}
    </Link>
  );
}
