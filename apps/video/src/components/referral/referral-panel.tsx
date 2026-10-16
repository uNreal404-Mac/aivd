"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { referralCopy, referralStatusLabel } from "@/lib/referral";

export interface ReferralRecordView {
  id: number;
  inviteeEmailMasked: string;
  status: string;
  createdAt: string;
  rewardedAt: string | null;
}

export interface ReferralRewardsView {
  enabled: boolean;
  inviterCredits: number;
  inviteeCredits: number;
  expiryDays: number;
}

export interface ReferralPanelData {
  available: boolean;
  link: string | null;
  records: ReferralRecordView[];
  rewards: ReferralRewardsView;
}

interface ReferralPanelProps {
  locale: string;
  initialData?: ReferralPanelData;
}

function extractData(payload: unknown): ReferralPanelData | null {
  if (!payload || typeof payload !== "object") return null;

  const record = payload as Record<string, unknown>;
  const candidate = "data" in record ? record.data : record;

  if (!candidate || typeof candidate !== "object") return null;

  return candidate as ReferralPanelData;
}

function formatDate(value: string | null): string {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toISOString().slice(0, 10);
}

export function ReferralPanel({ locale, initialData }: ReferralPanelProps) {
  const copy = referralCopy(locale);
  const [data, setData] = useState<ReferralPanelData | null>(
    initialData ?? null
  );
  const [loading, setLoading] = useState(!initialData);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (initialData) return;

    let active = true;

    async function load() {
      try {
        const response = await fetch("/api/v1/referral", { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`Request failed: ${response.status}`);
        }

        const payload: unknown = await response.json();
        if (active) setData(extractData(payload));
      } catch {
        if (active) setFailed(true);
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [initialData]);

  useEffect(() => {
    return () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);

  const handleCopy = useCallback(async () => {
    if (!data?.link) return;

    try {
      await navigator.clipboard.writeText(data.link);
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [data?.link]);

  const ready =
    !loading && !failed && data !== null && data.available && Boolean(data.link);

  return (
    <section className="ref-panel">
      <header className="ref-header">
        <h1 className="ref-title">{copy.title}</h1>
        <p className="ref-subtitle">{copy.subtitle}</p>
      </header>

      {loading ? <p className="ref-muted">…</p> : null}

      {!loading && (failed || !data || !data.available || !data.link) ? (
        <p className="ref-unavailable">{copy.unavailable}</p>
      ) : null}

      {ready && data && data.link ? (
        <>
          <div className="ref-link-row">
            <input
              className="ref-link-input"
              type="text"
              readOnly
              value={data.link}
              aria-label={copy.linkLabel}
            />
            <button
              className="ref-copy-button"
              type="button"
              onClick={handleCopy}
            >
              {copied ? copy.copied : copy.copy}
            </button>
          </div>

          {data.rewards.enabled ? (
            <p className="ref-rewards">
              {copy.rewardsLine
                .replace("{inviter}", String(data.rewards.inviterCredits))
                .replace("{invitee}", String(data.rewards.inviteeCredits))}
            </p>
          ) : (
            <p className="ref-muted">{copy.rewardsOff}</p>
          )}

          <h2 className="ref-steps-title">{copy.howItWorksTitle}</h2>
          <ol className="ref-steps">
            {copy.steps.map((step) => (
              <li className="ref-step" key={step}>
                {step}
              </li>
            ))}
          </ol>

          {data.records.length === 0 ? (
            <p className="ref-empty">{copy.recordsEmpty}</p>
          ) : (
            <table className="ref-table">
              <thead>
                <tr>
                  <th>{copy.colFriend}</th>
                  <th>{copy.colStatus}</th>
                  <th>{copy.colDate}</th>
                </tr>
              </thead>
              <tbody>
                {data.records.map((record) => (
                  <tr key={record.id}>
                    <td>{record.inviteeEmailMasked || "-"}</td>
                    <td>
                      <span
                        className={`ref-status ref-status-${record.status.toLowerCase()}`}
                      >
                        {referralStatusLabel(copy, record.status)}
                      </span>
                    </td>
                    <td>{formatDate(record.rewardedAt ?? record.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      ) : null}
    </section>
  );
}
