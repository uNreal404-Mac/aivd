"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface UserAdminActionsProps {
  userId: string;
  userName: string | null;
  userEmail: string;
  isAdmin: boolean;
  isSuperAccount: boolean;
  isBanned: boolean;
  locale: string;
}

export function UserAdminActions(props: UserAdminActionsProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState("");
  const [remark, setRemark] = useState("");
  const [banReason, setBanReason] = useState("");

  async function runAction(payload: Record<string, unknown>, success: string) {
    setBusy(true);
    try {
      const response = await fetch(`/api/v1/admin/users/${props.userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "操作失败");
      toast.success(success);
      setAmount("");
      setRemark("");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "操作失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        管理
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>管理用户</DialogTitle>
            <DialogDescription>
              {props.userName || "未设置昵称"} · {props.userEmail}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <section className="rounded-lg border p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">超级账号</p>
                  <p className="text-xs text-muted-foreground">
                    可发布受保护 Prompt；与付费套餐无关。
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={props.isSuperAccount ? "destructive" : "default"}
                  disabled={busy}
                  onClick={() =>
                    runAction(
                      {
                        action: "set_super_account",
                        enabled: !props.isSuperAccount,
                      },
                      props.isSuperAccount ? "已取消超级账号" : "已设为超级账号",
                    )
                  }
                >
                  {props.isSuperAccount ? "取消权限" : "授予权限"}
                </Button>
              </div>
            </section>

            <section className="space-y-3 rounded-lg border p-4">
              <div>
                <p className="font-medium">积分调整</p>
                <p className="text-xs text-muted-foreground">
                  正数增加，负数扣除；每笔操作会写入积分流水和审计日志。
                </p>
              </div>
              <div className="grid grid-cols-[120px_1fr] gap-2">
                <Input
                  type="number"
                  step="1"
                  placeholder="如 100 或 -20"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
                <Input
                  placeholder="调整原因（必填）"
                  value={remark}
                  onChange={(event) => setRemark(event.target.value)}
                />
              </div>
              <div className="flex justify-between gap-2">
                <Button variant="outline" size="sm" asChild>
                  <a href={`/${props.locale}/admin/transactions?userId=${props.userId}`}>
                    查看积分交易
                  </a>
                </Button>
                <Button
                  size="sm"
                  disabled={busy || !amount || remark.trim().length < 2}
                  onClick={() =>
                    runAction(
                      {
                        action: "adjust_credits",
                        amount: Number(amount),
                        remark,
                      },
                      "积分已调整",
                    )
                  }
                >
                  确认调整
                </Button>
              </div>
            </section>

            <section className="space-y-3 rounded-lg border border-destructive/40 p-4">
              <div>
                <p className="font-medium">账号状态</p>
                <p className="text-xs text-muted-foreground">
                  封禁会立即清理现有会话，并阻止受保护页面和 API。
                </p>
              </div>
              {!props.isBanned ? (
                <Input
                  placeholder="封禁原因（可选）"
                  value={banReason}
                  onChange={(event) => setBanReason(event.target.value)}
                />
              ) : null}
              <Button
                size="sm"
                variant={props.isBanned ? "outline" : "destructive"}
                disabled={busy || props.isAdmin}
                onClick={() =>
                  runAction(
                    {
                      action: "set_banned",
                      enabled: !props.isBanned,
                      reason: banReason,
                    },
                    props.isBanned ? "账号已解封" : "账号已封禁",
                  )
                }
              >
                {props.isAdmin
                  ? "管理员不可封禁"
                  : props.isBanned
                    ? "解除封禁"
                    : "封禁账号"}
              </Button>
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
