import { Device } from '@portal/shared';
import { EventEmitter } from 'events';

export class PresenceManager extends EventEmitter {
  private presentDevices: Map<string, Device> = new Map();
  private presenceTimers: Map<string, NodeJS.Timeout> = new Map();
  private presenceTimeout: number;

  constructor(presenceTimeout: number) {
    super();
    this.presenceTimeout = presenceTimeout;
  }

  markPresent(device: Device): void {
    const wasPresent = this.presentDevices.has(device.id);

    device.isPresent = true;
    device.lastMotionAt = new Date();
    this.presentDevices.set(device.id, device);

    // Clear existing timeout
    if (this.presenceTimers.has(device.id)) {
      clearTimeout(this.presenceTimers.get(device.id)!);
    }

    // Set timeout to mark as not present
    const timer = setTimeout(() => {
      this.markNotPresent(device.id);
    }, this.presenceTimeout);

    this.presenceTimers.set(device.id, timer);

    if (!wasPresent) {
      this.emit('presence_changed', device.groupId);
    }
  }

  markNotPresent(deviceId: string): void {
    const device = this.presentDevices.get(deviceId);
    if (!device) return;

    this.presentDevices.delete(deviceId);

    if (this.presenceTimers.has(deviceId)) {
      clearTimeout(this.presenceTimers.get(deviceId)!);
      this.presenceTimers.delete(deviceId);
    }

    this.emit('presence_changed', device.groupId);
  }

  getPresentDevicesInGroup(groupId: string): Device[] {
    return Array.from(this.presentDevices.values())
      .filter(device => device.groupId === groupId);
  }

  isPresent(deviceId: string): boolean {
    return this.presentDevices.has(deviceId);
  }

  cleanup(): void {
    for (const timer of this.presenceTimers.values()) {
      clearTimeout(timer);
    }
    this.presenceTimers.clear();
    this.presentDevices.clear();
  }
}
