import classNames from 'classnames';
import { ReactNode, Suspense } from 'react';
import { makeComponentHookable } from 'shared';
import '@/elements/feedback/spinner.css';

function Spinner({ size }: { size?: number }) {
  return (
    <span
      className='spinner'
      style={size !== undefined ? { width: size, height: size } : undefined}
      aria-label='Loading Spinner'
      data-testid='loader'
    />
  );
}

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
