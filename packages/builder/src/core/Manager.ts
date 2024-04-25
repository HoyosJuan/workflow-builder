import { Integration, Action } from "./Integration"
import { Workflow } from "./Workflow"
import { Event } from "./Event"

export type AppEvents = { [eventsGroup: string]: {[eventName: string]: string} }

export class Manager {
  readonly workflows: {[worflowID: string]: Workflow} = {}
  readonly integrations: {[integrationID: string]: Integration} = {}
  private readonly _events: { [eventID: string]: Event<Record<string, any>> } = {}
  
  private get _actions() {
    const actions: Action[] = []
    for (const id in this.integrations) {
      const integration = this.integrations[id]
      actions.push(...Object.values(integration.actions))
    }
    return actions
  }
  
  constructor(appEvents: AppEvents) {
    for (const groupName in appEvents) {
      const eventsGroup = appEvents[groupName]
      for (const eventName in eventsGroup) {
        const id = eventsGroup[eventName]
        this._events[id] = new Event()
      }
    }
  }

  private _registeredEvents: { [workflowID: string]: (data: Record<string, any>) => any } = {}
  
  private registerWorkflowEvent(workflow: Workflow) {
    const event = (data: Record<string, any>) => workflow.run(data)
    return this._registeredEvents[workflow.id] = event
  }

  addIntegration<T extends Integration>(...integrations: T[]) {
    for (const integration of integrations) {
      if (!(integration.id in this.integrations)) {
        this.integrations[integration.id] = integration
      }
    }
  }

  removeIntegration(id: string) {
    delete this.integrations[id]
  }

  getAction(id: string) {
    const action = this._actions.find(action => action.id === id)
    return action
  }
  
  addWorkflow(...workflows: Workflow[]) {
    for (const workflow of workflows) {
      const triggerEvent = this._events[workflow.triggerEvent]
      if (!triggerEvent) {
        console.warn(`Manager: There are no registered events that can run workflow ${workflow.id || workflow.name}.`)
        continue
      }
      if (!(workflow.id in this.workflows)) {
        this.workflows[workflow.id] = workflow
        const event = this.registerWorkflowEvent(workflow)
        triggerEvent.add(event)
      }
    }
  }

  removeWorkflow(id: string) {
    const workflow = this.workflows[id]
    if (!workflow) return
    const triggerEvent = this._events[workflow.triggerEvent]
    const event = this._registeredEvents[id]
    if (triggerEvent && event) triggerEvent.remove(event)
    delete this.workflows[id]
  }

  // Force to trigger a workflow.
  async triggerWorkflow(id: string, data?: Record<string, any>) {
    const workflow = this.workflows[id]
    if (!workflow) { return }
    const result = await workflow.run(data)
    return result
  }

  // Force an event to happen. It triggers all its subscribed workflows.
  triggerEvent(id: string, data?: Record<string, any>) {
    const event = this._events[id]
    if (!event) {
      throw new Error(`Manager: There is no event with ID: ${id}`)
    }
    event.trigger(data)
  }
}