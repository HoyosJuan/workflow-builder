import { WorkflowStep } from "./WorkflowStep"
import { IntegrationsManager } from './IntegrationsManager';

export interface WorkflowResult {
  step: string
  output: Record<string, any>
}

export class Workflow {
  id = "e34bf3f7-6dba-4bf8-9d2d-bd786ab07542" // Generate this dynamically
  name: string
  triggerEvent: string
  private _result: WorkflowResult[] = []
  private _steps: WorkflowStep[] = []
  private _currentStep = 0

  set steps(steps: { id: string, action: string, data: Record<string, any> }[]) {
    this._steps = []
    for (const rawStep of steps) {
      const config = {workflow: this.id, ...rawStep}
      const step = new WorkflowStep(this._manager, config)
      this._steps.push(step)
    }
  }

  constructor(private _manager: IntegrationsManager, name: string, triggerEvent: string) {
    this.name = name
    this.triggerEvent = triggerEvent
    _manager.addWorkflow(this)
  }

  async run(data?: Record<string, any>): Promise<WorkflowResult[]> { // Data is from the trigger event
    if (this._currentStep === 0) {
      this._result.push( { step: this.triggerEvent, output: data?? {} } )
    }
    const step = this._steps.slice(this._currentStep)[0]
    if (!step) {
      const result = [...this._result]
      this.clean()
      return result
    }
    const output = await step.run()
    this._result.push({ step: step.id, output })
    this._currentStep++
    return this.run(data)
  }

  private clean() {
    this._result = []
    this._currentStep = 0
  }

  processData(data: any) {
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

  private getResultFromStep(id: string, resultKey: string) {
    const step = this._result.find(result => result.step === id)
    if (step && step.output) { return step.output[resultKey] }
  }

  private replaceWildcard(templateString: string) {
    //@ts-ignore
    return templateString.replace(/\{\{([^}]+)\}\}/g, (match, variableName) => {
      const wildCardInformation = variableName.split(".")
      const [stepId, resultKey] = wildCardInformation
      const result = this.getResultFromStep(stepId, resultKey)
      return result
    })
  }
}