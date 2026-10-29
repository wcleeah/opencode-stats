import type { JSX } from 'react';

import { formatDateTime, formatRelativeTime } from '@/lib/format';
import {
  formatSharePct,
  presentGrokBotPlanUsage,
  type GrokBotPlanView,
  type PresentedShareRow,
} from '@/lib/grok-bot/plan-usage';

import { PendingAnchor } from '@/components/pending-anchor';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { PoolMeter } from '@/components/mcp/pool-meter';

interface GrokBotPlanUsageSectionProps {
  view: GrokBotPlanView;
  captureHref: (id: number) => string;
}

export function GrokBotPlanUsageSection(
  props: GrokBotPlanUsageSectionProps,
): JSX.Element {
  const showCaptures = props.view.recent.length > 1
    || (props.view.notice !== null && props.view.recent.length > 0);

  if (!props.view.snapshot) {
    return (
      <div className="space-y-3">
        {props.view.notice ? (
          <p className="text-sm text-error">{props.view.notice}</p>
        ) : (
          <Card>
            <div className="text-xs uppercase tracking-wider text-muted">Plan usage</div>
            <p className="mt-2 text-sm text-foreground">No plan usage posted.</p>
          </Card>
        )}
        {showCaptures ? (
          <CaptureList view={props.view} captureHref={props.captureHref} />
        ) : null}
      </div>
    );
  }

  const presented = presentGrokBotPlanUsage(props.view.snapshot.usage);
  return (
    <section className="space-y-3" aria-label="Plan usage">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-xs uppercase tracking-wider text-muted">Plan usage</h2>
        <p className="max-w-full break-words text-xs text-muted">
          {presented.source}
          {' · '}
          captured {presented.capturedAt}
          {' · '}
          stored {formatDateTime(props.view.snapshot.receivedAt)}
          {' ('}
          {formatRelativeTime(props.view.snapshot.receivedAt)}
          {')'}
        </p>
      </div>
      {showCaptures ? (
        <CaptureList view={props.view} captureHref={props.captureHref} />
      ) : null}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <PoolMeter
          label="Weekly plan"
          usedLabel={presented.weeklyLabel}
          percent={presented.weeklyPct}
          warn={presented.weeklyWarn}
        />
        <PlanFact label="Plan" value={presented.plan} />
        <PlanFact
          label="Resets"
          value={presented.resetLabel}
          detail={presented.resetDetail}
        />
        <PlanFact
          label="On-demand"
          value={presented.onDemandValue}
          detail={presented.onDemandDetail}
        />
      </div>
      {presented.reports.length === 0 ? (
        <Card>
          <p className="text-sm text-foreground">No share reports in this snapshot.</p>
        </Card>
      ) : (
        presented.reports.map((report, index) => (
          <Card key={`${index}-${report.period}-${report.breakdownLabel}`}>
            <div className="text-xs uppercase tracking-wider text-muted">
              {report.breakdownLabel}
            </div>
            <div className="mt-1 text-sm font-medium text-foreground">{report.title}</div>
            {report.period === report.title ? null : (
              <div className="mt-0.5 text-xs text-muted">{report.period}</div>
            )}
            {report.rows.length === 0 ? (
              <p className="mt-3 text-sm text-muted">No rows in this report.</p>
            ) : (
              <ShareList rows={report.rows} />
            )}
          </Card>
        ))
      )}
    </section>
  );
}

function CaptureList(props: GrokBotPlanUsageSectionProps): JSX.Element {
  const chipOn = 'inline-flex max-w-full items-center rounded-md border border-foreground px-2 py-1 text-xs text-foreground break-all';
  const chipOff = 'inline-flex max-w-full items-center rounded-md border border-border px-2 py-1 text-xs text-muted break-all hover:text-foreground';
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[10px] uppercase tracking-wide text-muted">Captures</span>
      {props.view.recent.map((item) => {
        const selected = item.id === props.view.selectedId;
        const className = selected ? chipOn : chipOff;
        const label = `${item.capturedAt} · ${formatSharePct(item.weeklyUsagePercentUsed)}`;
        if (selected) {
          return (
            <span key={item.id} aria-current="page" className={className}>
              {label}
            </span>
          );
        }
        return (
          <PendingAnchor
            key={item.id}
            href={props.captureHref(item.id)}
            history="push"
            className={className}
          >
            {label}
          </PendingAnchor>
        );
      })}
    </div>
  );
}

function PlanFact(props: {
  label: string;
  value: string;
  detail?: string;
}): JSX.Element {
  return (
    <Card className="h-full">
      <div className="text-xs uppercase tracking-wider text-muted">{props.label}</div>
      <div className="mt-1 break-words text-sm font-medium text-foreground">{props.value}</div>
      {props.detail ? (
        <div className="mt-0.5 break-words text-xs text-muted">{props.detail}</div>
      ) : null}
    </Card>
  );
}

function ShareList(props: {
  rows: readonly PresentedShareRow[];
  nested?: boolean;
}): JSX.Element {
  return (
    <ul className={props.nested ? 'space-y-2' : 'mt-3 space-y-3'}>
      {props.rows.map((row, index) => (
        <li key={`${index}-${row.title}`}>
          <ShareRow row={row} />
        </li>
      ))}
    </ul>
  );
}

function ShareRow(props: { row: PresentedShareRow }): JSX.Element {
  const row = props.row;
  const meta = [row.cadence, row.note, ...row.extras.map((extra) => `${extra.key} ${extra.value}`)]
    .filter((part): part is string => Boolean(part));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0 flex-1 break-words text-sm text-foreground">
          {row.title}
          {row.detail ? (
            <span className="ml-2 text-xs text-muted">{row.detail}</span>
          ) : null}
          {row.paused ? (
            <Badge variant="warning" className="ml-2 align-middle">Paused</Badge>
          ) : null}
        </div>
        <div className="shrink-0 font-mono text-xs tabular-nums text-foreground">
          {row.shareLabel}
        </div>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-sm bg-surface-alt" aria-hidden="true">
        <div className="h-full bg-foreground/70" style={{ width: `${row.barPct}%` }} />
      </div>
      {meta.length > 0 ? (
        <div className="mt-1 break-words text-xs text-muted">{meta.join(' · ')}</div>
      ) : null}
      {row.children.length > 0 ? (
        <div className="mt-2 border-l border-border pl-3">
          <ShareList rows={row.children} nested />
        </div>
      ) : null}
    </div>
  );
}
