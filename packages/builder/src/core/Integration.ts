export interface Action {
  id: string
  name?: string
  enabled: boolean
  run: (data: any) => Promise<any>
}

export interface Integration {
  id: string
  name?: string
  config?: Record<string, any>
  actions: {
    [name: string]: Action
  }
}