// on-blur validation is left out on purpose: mantine's reset() doesn't cancel pending
// debounced validations, so blurring a field via a submit/cancel click would re-add an
// error to the freshly reset form
export const liveValidation = {
  validateInputOnChange: true,
  validateDebounce: 400,
} as const;
