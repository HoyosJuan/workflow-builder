import { IntegrationsManager } from './IntegrationsManager';

interface ActionField {
  description?: string
  name: string
  label: string
  options?: string[]
  required: boolean
  type: "select" | "text" | "checkbox"
}

export abstract class IntegrationAction<I extends Record<string, any>, O extends Record<string, any>> {
  //A unique identifier of the action.
  abstract id: string

  //The ID of the integration this action belongs to.
  // abstract integration: string
  
  //Action name that is going to appear in the UI.
  abstract name: string
  
  //Weather this action is executable in a workflow.
  abstract enabled: boolean
  
  //The list of things this action returns.
  abstract returns: string[]
  
  //The list of fields to be filled when the user is setting up the action.
  abstract fields: ActionField[]

  constructor(protected _manager: IntegrationsManager) {}
  
  //The function that is going to run in the workflow.
  abstract run(data: I): Promise<O>
}

export abstract class Integration<T extends Record<string, any> = {}> {
  //Unique identifier of the integration.
  abstract id: string

  //Integration name as it should appear in the UI.
  abstract name: string

  //Weather this integration is usable in a workflow.
  abstract enabled: boolean

  //The actions this integration can invoke
  actions: {
    [name: string]: IntegrationAction<Record<string, any>, Record<string, any>>
  } = {}

  constructor(protected _manager: IntegrationsManager) {}

  config?: T
  async setup(config: T) {
    this.config = config
  }

  getActionById(id: string) {
    const action = Object.values(this.actions).find(action => action.id === id)
    return action
  }
}