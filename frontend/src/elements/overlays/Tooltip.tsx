import { Tooltip as MantineTooltip, TooltipProps } from '@mantine/core';
import classNames from 'classnames';
import { Children, cloneElement, forwardRef, isValidElement, ReactNode } from 'react';
import { makeComponentHookable } from 'shared';

type LabelableProps = { 'aria-label'?: string; children?: ReactNode };

const hasTextContent = (node: ReactNode) =>
  Children.toArray(node).some((child) => typeof child === 'string' || typeof child === 'number');

// mantine names the wrapper span, not the trigger, so icon-only triggers would have no accessible name
const withAccessibleName = (children: ReactNode, label: TooltipProps['label']) => {
  if (typeof label !== 'string' || !isValidElement<LabelableProps>(children)) return children;
  if (children.props['aria-label'] || hasTextContent(children.props.children)) return children;

  return cloneElement(children, { 'aria-label': label });
};

const Tooltip = forwardRef<HTMLDivElement, TooltipProps & { innerClassName?: string }>(
  ({ children, className, innerClassName, ...rest }, ref) => {
    return (
      <MantineTooltip ref={ref} className={classNames(className, 'w-fit leading-none')} {...rest}>
        <span className={classNames(innerClassName, 'inline-block')}>{withAccessibleName(children, rest.label)}</span>
      </MantineTooltip>
    );
  },
);

export default makeComponentHookable(Tooltip);
