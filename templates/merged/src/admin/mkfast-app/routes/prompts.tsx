import { AdminPromptsContent } from '@/components/admin/prompts/admin-prompts-content';
import { DashboardHeader } from '@/components/layout/dashboard-header';
import { Routes } from '@/lib/routes';
import { m } from '@/locale/paraglide/messages';
import {
  createFileRoute,
  Outlet,
  useRouterState,
} from '@tanstack/react-router';

export const Route = createFileRoute('/admin/prompts')({
  component: AdminPromptsPage,
});

function AdminPromptsPage() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname !== Routes.AdminPrompts) {
    return <Outlet />;
  }

  const breadcrumbs = [
    { label: m.admin_title(), isCurrentPage: false },
    { label: m.admin_prompts_title(), isCurrentPage: true },
  ];

  return (
    <>
      <DashboardHeader breadcrumbs={breadcrumbs} />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 lg:gap-6 lg:py-6">
            <div className="px-4 lg:px-6">
              <AdminPromptsContent />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
