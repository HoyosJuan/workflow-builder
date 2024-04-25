import { Manager } from './Manager';
import { Event } from './Event';

export interface WorkflowStep<T extends Record<string, any> = Record<string, any>> {
  id: string
  action: string
  data: T
}

interface RawWorkflow {
  id: string
  name?: string
  steps: WorkflowStep[]
}

export interface WorkflowResult {
  step: string
  output: Record<string, any>
}

export class Workflow {
  private _result: WorkflowResult[] = []
  private _currentStep = 0

  name?: string
  id: string = crypto.randomUUID()
  readonly triggerEvent: string
  readonly onWorkflowRun = new Event<WorkflowResult[]>()

  steps: WorkflowStep[] = []

  get raw(): RawWorkflow {
    const workflow = {
      id: this.id,
      name: this.name,
      steps: this.steps,
      trigger: this.triggerEvent
    }
    return workflow
  }

  constructor(private _manager: Manager, triggerEvent: string) {
    this.triggerEvent = triggerEvent
    _manager.addWorkflow(this)
  }

  private processData(data: any) {
    if ( typeof data === "object" && !Array.isArray(data) ) {
      const result: Record<string, any> = {}
      for (const key in data) {
        const value = data[key]
        result[key] = this.processData(value)
      }
      return result
    }
    if ( Array.isArray(data) ) {
      const result: any[] = []
      data.forEach( (d: any) => result.push(this.processData(d)) )
      return result
    }
    if (typeof data === "string") { return this.replaceWildcard(data) } 
    return data
  }

  private async runStep(id: string) {
    const step = this.steps.find(step => step.id === id)
    if (!step) throw new Error(`Workflow: step with id "${id}" wasn't found in workflow "${this.name || this.id}"`)
    const action = this._manager.getAction(step.action)
    if (!action) throw new Error(`Workflow: step action with id "${step.action}" wasn't found in the registered manager integrations.`)
    if (!action.enabled) throw new Error(`Workflow: step action "${action.name || action.id} is not available to run."`)
    const inputData: Record<string, any> = {}
    for (const key in step.data) {
      const value = step.data[key]
      // In value may come something like "Hi <<ee0b4bc6-b659-4d64-a222-252ae487ca02.assignedTo>>! This is a friendly topic reminder."
      // assignedTo should be a key from the result of step with id ee0b4bc6-b659-4d64-a222-252ae487ca02
      inputData[key] = this.processData(value)
    }
    const result = await action.run(inputData)
    return result
  }

  private clean() {
    this._result = []
    this._currentStep = 0
  }

  private getResultFromStep(id: string, resultKey: string) {
    const step = this._result.find(result => result.step === id)
    if (step && step.output) { return step.output[resultKey] }
  }

  private replaceWildcard(templateString: string) {
    //@ts-ignore
    // return templateString.replace(/\{\{([^}]+)\}\}/g, (match, variableName) => {
    return templateString.replace(/<<([^}]+)>>/g, (match, variableName) => {
      const wildCardInformation = variableName.split(".")
      const [stepId, resultKey] = wildCardInformation
      const result = this.getResultFromStep(stepId, resultKey)
      return result
    })
  }

  async run(data?: Record<string, any>): Promise<WorkflowResult[]> { // Data is from the trigger event
    if (this._currentStep === 0) {
      this._result.push( { step: this.triggerEvent, output: data?? {} } )
    }
    const step = this.steps.slice(this._currentStep)[0]
    if (!step) {
      const result = [...this._result]
      this.clean()
      this.onWorkflowRun.trigger(result)
      return result
    }
    const output = await this.runStep(step.id)
    this._result.push({ step: step.id, output })
    this._currentStep++
    return this.run(data)
  }

  fromJSON(data: RawWorkflow) {
    const { id, name, steps } = data
    this.id = id
    this.name = name
    this.steps = steps
  }
}