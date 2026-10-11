import { AdminEggConfigurationMatcher } from '@/lib/schemas/admin/eggConfigurations.ts';

export function eggConfigurationMatcherUsesEggs(matcher: AdminEggConfigurationMatcher): boolean {
  switch (matcher.type) {
    case 'and':
    case 'or':
      return matcher.matchers.some(eggConfigurationMatcherUsesEggs);
    case 'not':
      return eggConfigurationMatcherUsesEggs(matcher.matcher);
    case 'eggs':
    case 'nests':
      return true;
    default:
      return false;
  }
}
