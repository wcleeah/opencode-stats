'use client';

import { useState, type JSX } from 'react';

export function RetryButton(props: {
  readonly reset: () => void;
  readonly label?: string;
  readonly className?: string;
}): JSX.Element {
  const [retrying, setRetrying] = useState(false);
  const label = props.label ?? 'Retry';
  return (
    <button
      type="button"
      className={props.className}
      disabled={retrying}
      onClick={() => {
        setRetrying(true);
        props.reset();
      }}
    >
      {retrying ? `${label}…` : label}
    </button>
  );
}
