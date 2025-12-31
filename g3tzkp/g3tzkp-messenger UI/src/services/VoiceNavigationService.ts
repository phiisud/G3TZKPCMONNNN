import { Route, RouteStep } from '../types/navigation';

export interface VoiceInstruction {
  text: string;
  priority: 'low' | 'normal' | 'high';
  timestamp: number;
}

export class VoiceNavigationService {
  private speechSynthesis: SpeechSynthesis;
  private currentInstruction: string = '';
  private instructionQueue: VoiceInstruction[] = [];
  private isSpeaking: boolean = false;
  private settings: VoiceSettings;
  private enabled: boolean = true;
  private currentRoute: Route | null = null;
  private nextInstructionIndex: number = 0;

  constructor() {
    this.speechSynthesis = window.speechSynthesis;
    this.settings = this.loadSettings();
    this.initializeSpeechSynthesis();
  }

  private loadSettings(): VoiceSettings {
    const stored = localStorage.getItem('g3zkp_voice_settings');
    return stored ? JSON.parse(stored) : {
      enabled: true,
      voice: null,
      rate: 0.9,
      pitch: 1.0,
      volume: 0.8,
      language: 'en-US'
    };
  }

  private saveSettings(): void {
    localStorage.setItem('g3zkp_voice_settings', JSON.stringify(this.settings));
  }

  private initializeSpeechSynthesis(): void {
    // Load available voices
    const loadVoices = () => {
      const voices = this.speechSynthesis.getVoices();
      if (voices.length > 0) {
        // Set default voice if not set
        if (!this.settings.voice) {
          const englishVoice = voices.find(v => v.lang.startsWith('en'));
          if (englishVoice) {
            this.settings.voice = englishVoice.name;
            this.saveSettings();
          }
        }
      }
    };

    loadVoices();
    if (this.speechSynthesis.onvoiceschanged !== undefined) {
      this.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }

  async speakInstruction(instruction: string, priority: 'low' | 'normal' | 'high' = 'normal'): Promise<void> {
    if (!this.enabled || !this.settings.enabled) return;

    const voiceInstruction: VoiceInstruction = {
      text: instruction,
      priority,
      timestamp: Date.now()
    };

    // Add to queue with priority ordering
    this.addToQueue(voiceInstruction);

    // Speak immediately if not currently speaking or if high priority
    if (!this.isSpeaking || priority === 'high') {
      this.processQueue();
    }
  }

  private addToQueue(instruction: VoiceInstruction): void {
    // Insert based on priority
    const priorityOrder = { high: 0, normal: 1, low: 2 };
    const insertIndex = this.instructionQueue.findIndex(
      existing => priorityOrder[instruction.priority] < priorityOrder[existing.priority]
    );

    if (insertIndex === -1) {
      this.instructionQueue.push(instruction);
    } else {
      this.instructionQueue.splice(insertIndex, 0, instruction);
    }

    // Limit queue size
    if (this.instructionQueue.length > 10) {
      this.instructionQueue = this.instructionQueue.slice(0, 10);
    }
  }

  private async processQueue(): Promise<void> {
    if (this.instructionQueue.length === 0 || this.isSpeaking) return;

    const instruction = this.instructionQueue.shift()!;
    await this.speakText(instruction.text);
  }

  private async speakText(text: string): Promise<void> {
    return new Promise((resolve) => {
      if (!this.speechSynthesis) {
        console.warn('[VoiceNavigation] Speech synthesis not available');
        resolve();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = this.settings.rate;
      utterance.pitch = this.settings.pitch;
      utterance.volume = this.settings.volume;
      utterance.lang = this.settings.language;

      // Set voice if available
      if (this.settings.voice) {
        const voices = this.speechSynthesis.getVoices();
        const selectedVoice = voices.find(v => v.name === this.settings.voice);
        if (selectedVoice) {
          utterance.voice = selectedVoice;
        }
      }

      utterance.onstart = () => {
        this.isSpeaking = true;
        this.currentInstruction = text;
      };

      utterance.onend = () => {
        this.isSpeaking = false;
        this.currentInstruction = '';
        this.processQueue();
        resolve();
      };

      utterance.onerror = (error) => {
        console.error('[VoiceNavigation] Speech synthesis error:', error);
        this.isSpeaking = false;
        this.currentInstruction = '';
        this.processQueue();
        resolve();
      };

      this.speechSynthesis.speak(utterance);
    });
  }

  async announceManeuver(maneuver: any, distance: number): Promise<void> {
    const instruction = this.formatManeuverInstruction(maneuver, distance);
    await this.speakInstruction(instruction, 'high');
  }

  private formatManeuverInstruction(maneuver: any, distance: number): string {
    const type = maneuver.type || 'continue';
    const modifier = maneuver.modifier || '';
    const name = maneuver.name || 'the road';

    let instruction = '';

    // Add distance prefix
    if (distance > 1000) {
      instruction += `In ${(distance / 1000).toFixed(1)} kilometers, `;
    } else if (distance > 100) {
      instruction += `In ${Math.round(distance / 100) * 100} meters, `;
    } else if (distance > 50) {
      instruction += 'Soon, ';
    }

    // Format maneuver
    switch (type) {
      case 'turn':
        instruction += `turn ${modifier} onto ${name}`;
        break;
      case 'new name':
        instruction += `continue onto ${name}`;
        break;
      case 'depart':
        instruction += `head ${modifier} on ${name}`;
        break;
      case 'arrive':
        instruction += 'you have arrived at your destination';
        break;
      case 'merge':
        instruction += `merge ${modifier} onto ${name}`;
        break;
      case 'ramp':
        instruction += `take the ramp ${modifier}`;
        break;
      case 'fork':
        instruction += `keep ${modifier} at the fork`;
        break;
      case 'roundabout':
        instruction += `enter the roundabout, take the ${this.ordinalToText(maneuver.exit || 1)} exit onto ${name}`;
        break;
      case 'exit roundabout':
        instruction += `exit onto ${name}`;
        break;
      case 'rotary':
      case 'roundabout':
        instruction += `enter the roundabout, take the ${this.ordinalToText(maneuver.exit || 1)} exit`;
        break;
      default:
        instruction += `continue on ${name}`;
    }

    return instruction;
  }

  private ordinalToText(num: number): string {
    const ordinals = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];
    return ordinals[num - 1] || `${num}th`;
  }

  startNavigation(route: Route): void {
    this.currentRoute = route;
    this.nextInstructionIndex = 0;

    // Announce route start
    const totalDistance = route.distance;
    const totalTime = Math.round(route.duration / 60);

    let startMessage = `Starting navigation. Route is ${(totalDistance / 1000).toFixed(1)} kilometers, estimated time ${totalTime} minutes.`;

    if (route.legs[0]?.steps?.[0]) {
      const firstStep = route.legs[0].steps[0];
      startMessage += ` ${this.formatManeuverInstruction(firstStep.maneuver, firstStep.distance)}`;
    }

    this.speakInstruction(startMessage, 'high');
  }

  updateNavigation(currentPosition: [number, number], heading: number): void {
    if (!this.currentRoute) return;

    // Find next instruction based on current position
    const nextStep = this.findNextStep(currentPosition);
    if (nextStep && this.shouldAnnounceStep(nextStep, currentPosition)) {
      this.announceManeuver(nextStep.maneuver, nextStep.distance);
      this.nextInstructionIndex++;
    }
  }

  private findNextStep(currentPosition: [number, number]): any | null {
    if (!this.currentRoute?.legs[0]?.steps) return null;

    const steps = this.currentRoute.legs[0].steps;
    if (this.nextInstructionIndex >= steps.length) return null;

    return steps[this.nextInstructionIndex];
  }

  private shouldAnnounceStep(step: any, currentPosition: [number, number]): boolean {
    if (!step) return false;

    // Calculate distance to maneuver
    const distance = this.calculateDistanceToManeuver(step, currentPosition);

    // Announce based on distance and maneuver type
    const importantManeuvers = ['turn', 'roundabout', 'merge', 'ramp', 'fork'];

    if (importantManeuvers.includes(step.maneuver.type)) {
      return distance <= 500; // Announce important maneuvers 500m ahead
    } else {
      return distance <= 200; // Announce regular maneuvers 200m ahead
    }
  }

  private calculateDistanceToManeuver(step: any, currentPosition: [number, number]): number {
    // Simplified distance calculation
    // In real implementation, would use proper routing distance
    if (step.maneuver.location) {
      const [lon, lat] = step.maneuver.location;
      return this.haversineDistance(currentPosition, [lon, lat]);
    }
    return step.distance || 1000;
  }

  private haversineDistance(coord1: [number, number], coord2: [number, number]): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = coord1[1] * Math.PI / 180;
    const φ2 = coord2[1] * Math.PI / 180;
    const Δφ = (coord2[1] - coord1[1]) * Math.PI / 180;
    const Δλ = (coord2[0] - coord1[0]) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  stopNavigation(): void {
    this.currentRoute = null;
    this.nextInstructionIndex = 0;
    this.speakInstruction('Navigation stopped', 'normal');
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.speechSynthesis.cancel();
      this.instructionQueue = [];
      this.isSpeaking = false;
    }
  }

  updateSettings(settings: Partial<VoiceSettings>): void {
    this.settings = { ...this.settings, ...settings };
    this.saveSettings();
  }

  getSettings(): VoiceSettings {
    return { ...this.settings };
  }

  getAvailableVoices(): SpeechSynthesisVoice[] {
    return this.speechSynthesis.getVoices();
  }

  isCurrentlySpeaking(): boolean {
    return this.isSpeaking;
  }

  getCurrentInstruction(): string {
    return this.currentInstruction;
  }

  testVoice(): void {
    this.speakInstruction('Voice navigation is working correctly', 'normal');
  }
}

interface VoiceSettings {
  enabled: boolean;
  voice: string | null;
  rate: number;
  pitch: number;
  volume: number;
  language: string;
}

export const voiceNavigationService = new VoiceNavigationService();