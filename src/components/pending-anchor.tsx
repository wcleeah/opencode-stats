'use client';

import Link, { useLinkStatus } from 'next/link';
import type { JSX, MouseEvent, ReactNode, Ref } from 'react';

export type PendingHistory = 'push' | 'replace';

export interface PendingAnchorProps {
  readonly href: string;
  readonly history: PendingHistory;
  readonly disabled?: boolean;
  readonly title?: string;
  readonly ariaLabel?: string;
  readonly ariaCurrent?: 'page' | 'true' | 'false';
  readonly ariaPressed?: boolean;
  readonly className?: string;
  readonly onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
  readonly anchorRef?: Ref<HTMLAnchorElement>;
  readonly children: ReactNode;
}

function PendingAnchorFace(props: { readonly children: ReactNode }): JSX.Element {
  const { pending } = useLinkStatus();
  return (
    <span aria-busy={pending} data-pending={pending ? '' : undefined}>
      {props.children}
      {pending ? '…' : null}
    </span>
  );
}

export function PendingAnchor({
  href,
  history,
  disabled = false,
  title,
  ariaLabel,
  ariaCurrent,
  ariaPressed,
  className,
  onClick,
  anchorRef,
  children,
}: PendingAnchorProps): JSX.Element {
  if (disabled) {
    return (
      <button
        type="button"
        disabled
        className={className}
        title={title}
        aria-label={ariaLabel}
        aria-current={ariaCurrent}
        aria-pressed={ariaPressed}
      >
        {children}
      </button>
    );
  }

  return (
    <Link
      href={href}
      replace={history === 'replace'}
      className={className}
      title={title}
      aria-label={ariaLabel}
      aria-current={ariaCurrent}
      aria-pressed={ariaPressed}
      onClick={onClick}
      ref={anchorRef}
    >
      <PendingAnchorFace>{children}</PendingAnchorFace>
    </Link>
  );
}
