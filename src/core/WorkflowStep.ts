import { IntegrationAction } from './Integration';
import { Workflow } from './Workflow';
import { IntegrationsManager } from './IntegrationsManager';

export interface RawWorkflowStep {
  id: string
  workflow: string
  action: string
  data: Record<string, any>
}

export class WorkflowStep {
  id: string
  workflow: Workflow
  action: IntegrationAction<Record<string, any>, Record<string, any>>
  data: Record<string, any>

  constructor(manager: IntegrationsManager, config: RawWorkflowStep) {
    const { workflow, action, data, id } = config
    this.id = id

    if (!(workflow in manager.workflows)) {
      throw new Error(`Workflow with ID ${workflow} was not found`)
    }
    this.workflow = manager.workflows[workflow]

    if (!(action in manager.actions)) {
      throw new Error(`Action with ID ${action} was not found`)
    }
    this.action = manager.actions[action]

    this.data = data
  }

  async run() {
    const data: Record<string, any> = {}
    for (const key in this.data) {
      const value = this.data[key]
      // In value.data may come something like "Hi ${ee0b4bc6-b659-4d64-a222-252ae487ca02.assignedTo}! This is a friendly topic reminder."
      // assignedTo comes from step with id ee0b4bc6-b659-4d64-a222-252ae487ca02
      data[key] = this.workflow.processData(value)
    }
    const result = await this.action.run(data)
    return result
  }
}