import {
  PromptContent,
  type EditablePreview,
} from '@/components/admin/prompts/prompt-content';
import { Button } from '@/components/ui/button';
import { DashboardHeader } from '@/components/layout/dashboard-header';
import { useAdminPrompt, useUpdatePrompt } from '@/hooks/use-admin-prompts';
import { Routes } from '@/lib/routes';
import { m } from '@/locale/paraglide/messages';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';

export const Route = createFileRoute('/admin/prompts/$id/edit')({
  component: EditPromptPage,
});

function EditPromptPage() {
  const navigate = useNavigate();
  const { id } = Route.useParams();
  const promptId = Number(id);
  const query = useAdminPrompt(promptId);
  const updateMutation = useUpdatePrompt();

  const breadcrumbs = [
    { label: m.admin_title(), isCurrentPage: false },
    {
      label: m.admin_prompts_title(),
      href: Routes.AdminPrompts,
      isCurrentPage: false,
    },
    { label: m.admin_prompts_edit(), isCurrentPage: true },
  ];

  const handleSave = async (draft: EditablePreview) => {
    await updateMutation.mutateAsync({
      id: promptId,
      externalId: draft.externalId,
      sourceUrl: draft.sourceUrl,
      model: draft.model,
      prompt: draft.prompt,
      authorHandle: draft.authorHandle,
      authorName: draft.authorName,
      likes: draft.likes,
      views: draft.views,
      date: draft.date,
      categorySlugs: draft.categorySlugs,
      images: draft.images,
    });

    toast.success(m.admin_prompts_update_success());
    await navigate({ to: Routes.AdminPrompts });
  };

  return (
    <>
      <DashboardHeader breadcrumbs={breadcrumbs} />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 lg:gap-6 lg:py-6">
            <div className="px-4 lg:px-6">
              {query.isLoading ? (
                <div className="max-w-5xl rounded-md border p-4 text-sm text-muted-foreground">
                  {m.admin_prompts_loading()}
                </div>
              ) : query.data ? (
                <PromptContent
                  key={query.data.id}
                  initialDraft={{
                    externalId: query.data.externalId,
                    sourceUrl: query.data.sourceUrl,
                    model: query.data.model,
                    prompt: query.data.prompt,
                    authorHandle: query.data.authorHandle,
                    authorName: query.data.authorName,
                    likes: query.data.likes,
                    views: query.data.views,
                    date: query.data.date,
                    images: query.data.images,
                    categorySlugs: query.data.categorySlugs,
                  }}
                  title={m.admin_prompts_edit_title()}
                  description={m.admin_prompts_edit_description()}
                  saveLabel={m.admin_prompts_update_prompt()}
                  savingLabel={m.admin_prompts_saving()}
                  isSaving={updateMutation.isPending}
                  onSave={handleSave}
                />
              ) : (
                <div className="max-w-5xl space-y-3 rounded-md border p-4">
                  <div>
                    <h2 className="font-semibold">
                      {m.admin_prompts_not_found_title()}
                    </h2>
                    <p className="text-muted-foreground text-sm">
                      {m.admin_prompts_not_found_description()}
                    </p>
                  </div>
                  <Button render={<Link to={Routes.AdminPrompts} />}>
                    {m.admin_prompts_back_to_prompts()}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
