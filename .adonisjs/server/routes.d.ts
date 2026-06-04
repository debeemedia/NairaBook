import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'home': { paramsTuple?: []; params?: {} }
    'webhooks.handle_whats_app': { paramsTuple?: []; params?: {} }
    'dashboard.show': { paramsTuple: [ParamValue]; params: {'shortCode': ParamValue} }
  }
  GET: {
    'home': { paramsTuple?: []; params?: {} }
    'dashboard.show': { paramsTuple: [ParamValue]; params: {'shortCode': ParamValue} }
  }
  HEAD: {
    'home': { paramsTuple?: []; params?: {} }
    'dashboard.show': { paramsTuple: [ParamValue]; params: {'shortCode': ParamValue} }
  }
  POST: {
    'webhooks.handle_whats_app': { paramsTuple?: []; params?: {} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}