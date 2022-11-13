export class PipelinePostResponse {
    id: string = ''
    steps: string[] = []

    constructor(init?: Partial<PipelinePostResponse>) {
        if (!init) return

        Object.assign(this, init)

        if (init.steps) {
            this.steps = init.steps.slice()
        }
    }

}