import { createFileRoute } from '@tanstack/react-router';
import { DashboardHeader } from '@/components/layout/dashboard-header';
import { TaskDetailPageContent } from '@/components/admin/tasks/task-detail-page';
import { useTaskDetail, useForceFailTask } from '@/hooks/use-admin-tasks';
import { m } from '@/locale/paraglide/messages';

export const Route = createFileRoute('/admin/task/$id')({
  component: AdminTaskDetailPage,
});

function AdminTaskDetailPage() {
  const { id } = Route.useParams();
  const { data, isLoading } = useTaskDetail(id);
  const forceFailMutation = useForceFailTask(id);

  const breadcrumbs = [
    { label: m.admin_title() },
    { label: m.admin_tasks_title(), href: '/admin/tasks' },
    { label: id, isCurrentPage: true },
  ];

  return (
    <>
      <DashboardHeader breadcrumbs={breadcrumbs} />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 lg:gap-6 lg:py-6">
            <div className="px-4 lg:px-6">
              <TaskDetailPageContent
                data={data ?? null}
                isLoading={isLoading}
                onForceFail={() => forceFailMutation.mutate()}
                isForceFailPending={forceFailMutation.isPending}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
