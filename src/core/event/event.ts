/**
 * Base event, equivalent of `Symfony\Contracts\EventDispatcher\Event`.
 * Listeners can call {@link stopPropagation} to prevent lower priority listeners from running.
 */
export class Event {
  private propagationStopped = false;

  isPropagationStopped(): boolean {
    return this.propagationStopped;
  }

  stopPropagation(): void {
    this.propagationStopped = true;
  }
}
