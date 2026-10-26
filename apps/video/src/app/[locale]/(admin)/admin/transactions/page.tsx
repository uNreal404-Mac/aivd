import { and, count, desc, eq, like, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { creditTransactions, users } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string; userId?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const limit = 30;
  const offset = (page - 1) * limit;
  const search = params.search?.trim() || "";
  const filters = [];

  if (params.userId) filters.push(eq(creditTransactions.userId, params.userId));
  if (search) {
    const pattern = `%${search.toLowerCase()}%`;
    filters.push(
      or(
        like(sql`lower(${users.email})`, pattern),
        like(sql`lower(coalesce(${users.name}, ''))`, pattern),
        like(sql`lower(coalesce(${creditTransactions.remark}, ''))`, pattern),
        like(sql`lower(${creditTransactions.transNo})`, pattern),
      )!,
    );
  }
  const where = filters.length ? and(...filters) : undefined;

  const [totalResult, rows] = await Promise.all([
    db
      .select({ count: count() })
      .from(creditTransactions)
      .leftJoin(users, eq(users.id, creditTransactions.userId))
      .where(where),
    db
      .select({
        id: creditTransactions.id,
        transNo: creditTransactions.transNo,
        transType: creditTransactions.transType,
        credits: creditTransactions.credits,
        balanceAfter: creditTransactions.balanceAfter,
        remark: creditTransactions.remark,
        createdAt: creditTransactions.createdAt,
        userId: creditTransactions.userId,
        userName: users.name,
        userEmail: users.email,
      })
      .from(creditTransactions)
      .leftJoin(users, eq(users.id, creditTransactions.userId))
      .where(where)
      .orderBy(desc(creditTransactions.createdAt))
      .limit(limit)
      .offset(offset),
  ]);
  const total = totalResult[0]?.count || 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">积分交易</h1>
        <p className="text-muted-foreground">共 {total} 条流水，包含充值、消费、退款和后台调整。</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form className="flex gap-2">
            {params.userId ? <input type="hidden" name="userId" value={params.userId} /> : null}
            <Input name="search" defaultValue={search} placeholder="搜索用户、流水号或备注…" />
            <Button type="submit">搜索</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>流水明细</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>时间</TableHead>
                <TableHead>用户</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>变动</TableHead>
                <TableHead>变动后余额</TableHead>
                <TableHead>备注</TableHead>
                <TableHead>流水号</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length ? rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {new Date(row.createdAt).toLocaleString("zh-CN")}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{row.userName || "未设置"}</div>
                    <div className="text-xs text-muted-foreground">{row.userEmail || row.userId}</div>
                  </TableCell>
                  <TableCell><Badge variant="outline">{row.transType}</Badge></TableCell>
                  <TableCell className={row.credits >= 0 ? "font-semibold text-green-600" : "font-semibold text-red-600"}>
                    {row.credits >= 0 ? "+" : ""}{row.credits}
                  </TableCell>
                  <TableCell>{row.balanceAfter}</TableCell>
                  <TableCell className="max-w-[280px] truncate" title={row.remark || ""}>{row.remark || "—"}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{row.transNo}</TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={7} className="h-24 text-center">暂无流水</TableCell></TableRow>
              )}
            </TableBody>
          </Table>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">第 {page} / {totalPages} 页</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} asChild={page > 1}>
                <a href={`?page=${page - 1}${params.userId ? `&userId=${encodeURIComponent(params.userId)}` : ""}${search ? `&search=${encodeURIComponent(search)}` : ""}`}>上一页</a>
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} asChild={page < totalPages}>
                <a href={`?page=${page + 1}${params.userId ? `&userId=${encodeURIComponent(params.userId)}` : ""}${search ? `&search=${encodeURIComponent(search)}` : ""}`}>下一页</a>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
