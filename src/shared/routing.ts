/** 站点唯一路由形状；解析和导航属于 app，这里只提供无 UI 契约。 */
export type Route =
  | { kind: 'home' }
  | { kind: 'browse' }
  | { kind: 'albums' }
  | { kind: 'album'; id: string }
  | { kind: 'not-found' };
