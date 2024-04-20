import { Integration, IntegrationAction } from "./Integration"
import { Workflow } from "./Workflow"

class Event<T> {
  private handlers: (T extends void ? { (): void } : { (data: T): void })[] = [];

  add(handler: T extends void ? { (): void } : { (data: T): void }): void {
    this.handlers.push(handler);
  }

  remove(handler: T extends void ? { (): void } : { (data: T): void }): void {
    this.handlers = this.handlers.filter((h) => h !== handler);
  }

  trigger = async (data?: T) => {
    const handlers = this.handlers.slice(0);
    for (const handler of handlers) {
      await handler(data as any);
    }
  };

  reset() {
    this.handlers.length = 0;
  }

}

export type AppEvents = { [eventsGroup: string]: {[eventName: string]: string} }

export class IntegrationsManager {
  readonly integrations: {[integrationID: string]: Integration} = {}
  readonly workflows: { [workflowID: string]: Workflow } = {}
  readonly actions: { [actionID: string]: IntegrationAction<Record<string, any>, Record<string, any>> } = {}
  private readonly _events: {[eventID: string]: Event<Record<string, any>>} = {}
  
  constructor(appEvents: AppEvents) {
    for (const groupName in appEvents) {
      const eventsGroup = appEvents[groupName]
      for (const eventName in eventsGroup) {
        const id = eventsGroup[eventName]
        this._events[id] = new Event()
      }
    }
  }

  addIntegration(...integrations: Integration[]) {
    for (const integration of integrations) {
      if (!(integration.id in this.integrations)) {
        this.integrations[integration.id] = integration
      }
    }
  }

  removeIntegration(id: string) {
    delete this.integrations[id]
  }

  addAction(...actions: IntegrationAction<Record<string, any>, Record<string, any>>[]) {
    for (const action of actions) {
      if (!(action.id in this.actions)) {
        this.actions[action.id] = action
      }
    }
  }

  removeAction(id: string) {
    delete this.actions[id]
  }

  private _registeredEvents: {[workflowID: string]: (data: Record<string, any>) => any} = {}
  private registerWorkflowEvent(workflow: Workflow) {
    const event = (data: Record<string, any>) => workflow.run(data)
    return this._registeredEvents[workflow.id] = event
  }
  
  addWorkflow(...workflows: Workflow[]) {
    for (const workflow of workflows) {
      const triggerEvent = this._events[workflow.triggerEvent]
      if (!triggerEvent) {
        throw new Error(`There is no registered events that can run workflow ${workflow.id}: ${workflow.name}`)
      }
      if (!(workflow.id in this.integrations)) {
        this.workflows[workflow.id] = workflow
        const event = this.registerWorkflowEvent(workflow)
        triggerEvent.add(event)
      }
    }
  }

  removeWorkflow(id: string) {
    if (id in this.workflows) {
      const workflow = this.workflows[id]
      const triggerEvent = this._events[workflow.triggerEvent]
      const event = this._registeredEvents[id]
      if (triggerEvent && event) {
        triggerEvent.remove(event)
      }
      delete this.workflows[id]
    }
  }

  // Force to trigger a workflow.
  async triggerWorkflow(id: string, data?: Record<string, any>) {
    const workflow = this.workflows[id]
    if (!workflow) { return }
    const result = await workflow.run(data)
    return result
  }

  // Force an event to happen. It triggers all its subscribed workflows.
  async triggerEvent(id: string, data?: Record<string, any>) {
    const event = this._events[id]
    if (!event) {
      throw new Error(`There is no event with ID: ${id}`)
    }
    await event.trigger(data)
  }
}