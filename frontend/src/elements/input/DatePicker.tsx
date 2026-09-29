import { DatePickerProps, DatePicker as MantineDatePicker } from '@mantine/dates';
import { forwardRef } from 'react';
import { makeComponentHookable } from 'shared';

const DatePicker = forwardRef<HTMLDivElement, DatePickerProps>(({ className, ...rest }, ref) => {
  return <MantineDatePicker ref={ref} className={className} {...rest} />;
});

export default makeComponentHookable(DatePicker);
