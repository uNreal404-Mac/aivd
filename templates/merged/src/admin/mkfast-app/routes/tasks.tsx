import { createFileRoute } from '@tanstack/react-router';
import { DashboardHeader } from '@/components/layout/dashboard-header';
import { AdminTasksContent } from '@/components/admin/tasks/admin-tasks-content';
import { m } from '@/locale/paraglide/messages';

export const Route = createFileRoute('/admin/tasks')({
  component: AdminTasksPage,
});

function AdminTasksPage() {
  const breadcrumbs = [
    { label: m.admin_title(), isCurrentPage: false },
    { label: m.admin_tasks_title(), isCurrentPage: true },
  ];

  return (
    <>
      <DashboardHeader breadcrumbs={breadcrumbs} />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 lg:gap-6 lg:py-6">
            <div className="px-4 lg:px-6">
              <AdminTasksContent />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
