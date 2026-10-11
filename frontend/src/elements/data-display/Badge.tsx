import { BadgeProps, Badge as MantineBadge } from '@mantine/core';
import classNames from 'classnames';
import { forwardRef } from 'react';
import { makeComponentHookable } from 'shared';
import Spinner from '@/elements/feedback/Spinner.tsx';

const Badge = forwardRef<HTMLDivElement, BadgeProps & { loading?: boolean }>(
  ({ className, loading, color, leftSection, ...rest }, ref) => {
    return (
      <MantineBadge
        ref={ref}
        className={classNames(className, 'font-semibold!')}
        color={loading ? 'gray' : color}
        leftSection={loading ? <Spinner size={10} /> : leftSection}
        aria-busy={loading || undefined}
        {...rest}
      />
    );
  },
);

export default makeComponentHookable(Badge);
