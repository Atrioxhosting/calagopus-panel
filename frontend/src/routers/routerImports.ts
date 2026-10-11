export const routerImports = {
  oobe: () => import('./OobeRouter.tsx'),
  authentication: () => import('./AuthenticationRouter.tsx'),
  dashboard: () => import('./DashboardRouter.tsx'),
  admin: () => import('./AdminRouter.tsx'),
  server: () => import('./ServerRouter.tsx'),
};

export function preloadRouterForPath(pathname: string) {
  const [, scope] = pathname.split('/');

  const load =
    scope === 'oobe'
      ? routerImports.oobe
      : scope === 'auth'
        ? routerImports.authentication
        : scope === 'admin'
          ? routerImports.admin
          : scope === 'server'
            ? routerImports.server
            : routerImports.dashboard;

  load().catch(() => undefined);
}
