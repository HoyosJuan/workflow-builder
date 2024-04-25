export interface IntegrationAction{
  id: string
  name?: string
  enabled: boolean
  run: (data: any) => Promise<any>
}

export abstract class Integration {
  readonly abstract id: string
  name?: string
  abstract config?: Record<string, any>
  abstract actions: { [key: string]: IntegrationAction }

  throwMissingConfiguration(missingKey?: string) {
    throw new Error(`Integration: ${missingKey ? `"${missingKey}"` : ""} configuration is missing in integration "${this.name || this.id}".`)
  }
} 