import { createFileRoute } from '@tanstack/react-router';
import { DashboardHeader } from '@/components/layout/dashboard-header';
import { AdminRedemptionsContent } from '@/components/admin/redemptions/admin-redemptions-content';
import { m } from '@/locale/paraglide/messages';

export const Route = createFileRoute('/admin/redemptions')({
  component: AdminRedemptionsPage,
});

function AdminRedemptionsPage() {
  const breadcrumbs = [
    { label: m.admin_title(), isCurrentPage: false },
    { label: m.admin_redemptions_title(), isCurrentPage: true },
  ];

  return (
    <>
      <DashboardHeader breadcrumbs={breadcrumbs} />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 lg:gap-6 lg:py-6">
            <div className="px-4 lg:px-6">
              <AdminRedemptionsContent />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
