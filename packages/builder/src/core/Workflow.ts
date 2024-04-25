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

  /**
   * The optional name of the workflow. This can be used to give the workflow a human-readable identifier.
   */
  name?: string

  /**
   * The unique identifier for the workflow, automatically generated using the `crypto.randomUUID()` method unless something custom is set.
   * This ensures that each workflow instance has a distinct ID for identification purposes.
   */
  id: string = crypto.randomUUID()

  readonly triggerEvent: string
  readonly onWorkflowRun = new Event<WorkflowResult[]>()

  steps: WorkflowStep[] = []

  /**
   * Getter for the raw representation of the workflow.
   * This method constructs and returns an object that represents the current state of the workflow,
   * including its unique identifier, optional name, steps, and the event that triggers the workflow.
   * This can be used to serialize the workflow in a JSON file.
   * 
   * @returns {RawWorkflow} An object conforming to the `RawWorkflow` interface, containing the workflow's
   *                        current state, including its `id`, optional `name`, `steps`, and the `trigger`
   *                        event name.
   */
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

  /**
   * Executes the workflow processing each step sequentially until completion.
   * This method handles the execution flow of the workflow steps, including initializing the workflow result
   * with the trigger event data, running each step, and triggering the `onWorkflowRun` event upon completion.
   * 
   * @param data Optional data object from the trigger event that can be used in the workflow's first step.
   *             This data is passed as the output of the "trigger event" step.
   * @returns A promise that resolves with an array of `WorkflowResult` objects, representing the output of each step in the workflow.
   */
  async run(data?: Record<string, any>): Promise<WorkflowResult[]> {
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

  /**
   * Initializes the workflow instance with data from a `RawWorkflow` object.
   * This method is used to set the workflow's properties such as `id`, `name`, and `steps`
   * based on the provided raw workflow data. It's useful for reconstructing a workflow
   * from a serialized or stored state.
   * 
   * @param data - An object conforming to the `RawWorkflow` interface, containing the necessary
   *               information to initialize the workflow, including its unique identifier,
   *               an optional name, and the sequence of steps that comprise the workflow.
   */
  fromJSON(data: RawWorkflow) {
    const { id, name, steps } = data
    this.id = id
    this.name = name
    this.steps = steps
  }
}