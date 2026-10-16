"use client";

import { useEffect, useMemo, useState } from "react";

import {
  type AccountCopy,
  type CreditTransactionView,
  type TxFilter,
  formatCredits,
  parseHistoryResponse,
  txGroup,
  txMatchesFilter,
} from "@/lib/account-view";

const PAGE_SIZE = 20;

function creditsCellClass(credits: number): string {
  if (credits > 0) {
    return "acct-td acct-positive";
  }
  if (credits < 0) {
    return "acct-td acct-negative";
  }
  return "acct-td";
}

export interface AccountActivityProps {
  copy: AccountCopy;
  locale: string;
}

export function AccountActivity({ copy, locale }: AccountActivityProps) {
  const [transactions, setTransactions] = useState<CreditTransactionView[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [filter, setFilter] = useState<TxFilter>("all");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadInitial = async () => {
      setLoading(true);
      setError(false);

      try {
        const response = await fetch(
          `/api/v1/credit/history?limit=${PAGE_SIZE}&offset=0`
        );
        if (cancelled) {
          return;
        }

        const json: unknown = await response.json().catch(() => null);
        if (cancelled) {
          return;
        }

        if (!response.ok) {
          setError(true);
          setTransactions([]);
          setHasMore(false);
          setNextCursor(null);
          return;
        }

        const result = parseHistoryResponse(json);
        setTransactions(result.transactions);
        setHasMore(result.hasMore);
        setNextCursor(result.nextCursor);
      } catch {
        if (!cancelled) {
          setError(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadInitial();

    return () => {
      cancelled = true;
    };
  }, []);

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    [locale]
  );

  const visible = useMemo(
    () => transactions.filter((tx) => txMatchesFilter(tx.transType, filter)),
    [transactions, filter]
  );

  const filters: { value: TxFilter; label: string }[] = [
    { value: "all", label: copy.filterAll },
    { value: "purchase", label: copy.filterPurchases },
    { value: "usage", label: copy.filterUsage },
    { value: "refund", label: copy.filterRefunds },
  ];

  const formatDate = (value: string): string => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return dateFormatter.format(date);
  };

  const loadMore = async () => {
    if (!nextCursor || loadingMore) {
      return;
    }

    setLoadingMore(true);
    setError(false);

    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
      params.set("offset", nextCursor);
      params.set("cursor", nextCursor);

      const response = await fetch(
        `/api/v1/credit/history?${params.toString()}`
      );
      const json: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        setError(true);
        return;
      }

      const result = parseHistoryResponse(json);
      setTransactions((prev) => [...prev, ...result.transactions]);
      setHasMore(result.hasMore);
      setNextCursor(result.nextCursor);
    } catch {
      setError(true);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <section className="acct-card">
      <h2 className="acct-card-heading">{copy.activityHeading}</h2>

      <div className="acct-chips">
        {filters.map((option) => (
          <button
            key={option.value}
            type="button"
            className={
              option.value === filter
                ? "acct-chip acct-chip-active"
                : "acct-chip"
            }
            onClick={() => setFilter(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {error ? <p className="acct-error">{copy.errorGeneric}</p> : null}

      {loading ? (
        <>
          <p className="acct-muted">{copy.loading}</p>
          <div className="acct-skeleton-row" />
          <div className="acct-skeleton-row" />
          <div className="acct-skeleton-row" />
        </>
      ) : visible.length === 0 ? (
        <div className="acct-empty">{copy.empty}</div>
      ) : (
        <div className="acct-table-wrap">
          <table className="acct-table">
            <thead>
              <tr>
                <th className="acct-th">{copy.colDate}</th>
                <th className="acct-th">{copy.colType}</th>
                <th className="acct-th">{copy.colCredits}</th>
                <th className="acct-th">{copy.colBalance}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((tx) => (
                <tr key={tx.id} className="acct-row">
                  <td className="acct-td">{formatDate(tx.createdAt)}</td>
                  <td className="acct-td">
                    {copy.typeLabels[txGroup(tx.transType)]}
                    {tx.remark ? (
                      <span className="acct-remark">{tx.remark}</span>
                    ) : null}
                  </td>
                  <td className={creditsCellClass(tx.credits)}>
                    {formatCredits(tx.credits)}
                  </td>
                  <td className="acct-td">{tx.balanceAfter}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && hasMore ? (
        <div className="acct-actions">
          <button
            type="button"
            className="acct-button acct-button-secondary"
            onClick={() => {
              void loadMore();
            }}
            disabled={loadingMore}
          >
            {copy.loadMore}
          </button>
        </div>
      ) : null}
    </section>
  );
}
