export class MutationQueue {
  private tail: Promise<void> = Promise.resolve()
  private disposed = false

  async run<T>(operation: () => Promise<T>): Promise<T> {
    if (this.disposed) {
      throw new Error('Mutation queue has been disposed')
    }

    const previous = this.tail
    let release!: () => void
    this.tail = new Promise<void>((resolve) => {
      release = resolve
    })

    await previous
    try {
      return await operation()
    } finally {
      release()
    }
  }

  async dispose(): Promise<void> {
    this.disposed = true
    await this.tail
  }
}
