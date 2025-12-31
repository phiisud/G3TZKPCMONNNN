const GATEWAY_URL = 'http://localhost:8080';

export interface DeployedApp {
  name: string;
  appId: string;
  size: string;
  deployedAt: string;
}

export interface DeployResult {
  success: boolean;
  appId?: string;
  name?: string;
  error?: string;
}

export interface GatewayStatus {
  running: boolean;
  port: number;
  apps: number;
}

export async function getDeployedApps(): Promise<DeployedApp[]> {
  try {
    const response = await fetch(`${GATEWAY_URL}/api/apps`);
    if (!response.ok) throw new Error('Gateway not available');
    const data = await response.json();
    return data.apps || [];
  } catch {
    return [];
  }
}

export async function getGatewayStatus(): Promise<GatewayStatus> {
  try {
    const response = await fetch(`${GATEWAY_URL}/api/health`);
    if (!response.ok) throw new Error('Gateway not available');
    const appsResponse = await fetch(`${GATEWAY_URL}/api/apps`);
    const appsData = appsResponse.ok ? await appsResponse.json() : { apps: [] };
    return {
      running: true,
      port: 8080,
      apps: appsData.apps?.length || 0
    };
  } catch {
    return {
      running: false,
      port: 8080,
      apps: 0
    };
  }
}

export async function resolveName(name: string): Promise<string | null> {
  try {
    const response = await fetch(`${GATEWAY_URL}/api/resolve/${name}`);
    if (!response.ok) return null;
    const data = await response.json();
    return data.appId || null;
  } catch {
    return null;
  }
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  });
}
