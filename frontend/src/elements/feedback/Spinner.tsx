import { useMergedRef } from '@mantine/hooks';
import classNames from 'classnames';
import { CSSProperties, forwardRef, ReactNode, Suspense, SyntheticEvent } from 'react';
import { makeComponentHookable } from 'shared';
import '@/elements/feedback/spinner.css';

const bootStartTime = document.querySelector('#root .spinner')?.getAnimations()[0]?.startTime;
const spinnerEpoch = typeof bootStartTime === 'number' ? bootStartTime : 0;

function syncSpinnerAnimations(element: HTMLElement | null) {
  if (!element) return;

  for (const animation of element.getAnimations()) {
    animation.startTime = spinnerEpoch;
  }
}

const syncSpinnerAnimationsOnStart = (event: SyntheticEvent<HTMLElement>) => syncSpinnerAnimations(event.currentTarget);

function Spinner({ size }: { size?: number }) {
  return (
    <span
      ref={syncSpinnerAnimations}
      onAnimationStart={syncSpinnerAnimationsOnStart}
      className='spinner'
      style={size !== undefined ? ({ '--loader-size': `${size}px` } as CSSProperties) : undefined}
      aria-label='Loading Spinner'
      data-testid='loader'
    />
  );
}

export const SpinnerLoader = forwardRef<HTMLSpanElement, { className?: string; style?: CSSProperties }>(
  ({ className, ...rest }, ref) => {
    const mergedRef = useMergedRef(ref, syncSpinnerAnimations);

    return (
      <span
        ref={mergedRef}
        className={classNames('spinner', className)}
        {...rest}
        onAnimationStart={syncSpinnerAnimationsOnStart}
      />
    );
  },
);

export default makeComponentHookable(Spinner, {
  Centered: makeComponentHookable(({ size, className }: { size?: number; className?: string }) => (
    <div className={classNames('flex items-center justify-center py-6', className)}>
      <Spinner size={size} />
    </div>
  )),
  Suspense: makeComponentHookable(({ children, className }: { children: ReactNode; className?: string }) => (
    <Suspense
      fallback={
        <div className={classNames('flex items-center justify-center', className)}>
          <Spinner />
        </div>
      }
    >
      {children}
    </Suspense>
  )),
});
