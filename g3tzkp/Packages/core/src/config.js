import { NodeType, NetworkMode } from './types';
import { generateNodeId } from './utils/hash';
import * as fs from 'fs/promises';
import * as path from 'path';
export class ConfigurationManager {
    config;
    configPath;
    constructor(partial = {}, configPath) {
        this.configPath = configPath || './config/local.config.json';
        this.config = this.buildConfig(partial);
    }
    buildConfig(partial) {
        return {
            node: {
                type: partial.node?.type ?? NodeType.PWA,
                id: partial.node?.id ?? generateNodeId(),
                version: partial.node?.version ?? "1.0.0",
                capabilities: partial.node?.capabilities ?? ["messaging", "zkp", "p2p"],
                publicKey: partial.node?.publicKey ?? new Uint8Array(32)
            },
            network: {
                mode: partial.network?.mode ?? NetworkMode.LOCAL_P2P,
                bootstrapNodes: partial.network?.bootstrapNodes ?? [],
                enableRelay: partial.network?.enableRelay ?? false,
                enableNatTraversal: partial.network?.enableNatTraversal ?? false,
                maxConnections: partial.network?.maxConnections ?? 50,
                connectionTimeout: partial.network?.connectionTimeout ?? 30000,
                localPort: partial.network?.localPort ?? 4001,
                httpPort: partial.network?.httpPort ?? 3000,
                metricsPort: partial.network?.metricsPort ?? 8080
            },
            security: {
                zkpCircuitVersion: partial.security?.zkpCircuitVersion ?? "g3zkp-v1.0",
                encryptionProtocol: partial.security?.encryptionProtocol ?? "x25519-chacha20poly1305",
                forwardSecrecy: partial.security?.forwardSecrecy ?? true,
                postCompromiseSecurity: partial.security?.postCompromiseSecurity ?? true,
                auditLevel: partial.security?.auditLevel ?? "standard",
                keyRotationInterval: partial.security?.keyRotationInterval ?? 86400000
            },
            storage: {
                messageRetentionDays: partial.storage?.messageRetentionDays ?? 30,
                maxMessageSize: partial.storage?.maxMessageSize ?? 10 * 1024 * 1024,
                enableEphemeral: partial.storage?.enableEphemeral ?? false,
                cacheSize: partial.storage?.cacheSize ?? 100 * 1024 * 1024,
                encryptAtRest: partial.storage?.encryptAtRest ?? true,
                dataPath: partial.storage?.dataPath ?? "./data"
            },
            messenger: {
                provisionMode: partial.messenger?.provisionMode ?? "AUTO",
                minProofs: partial.messenger?.minProofs ?? 10,
                proofExpirationDays: partial.messenger?.proofExpirationDays ?? 90,
                messageRetentionDays: partial.messenger?.messageRetentionDays ?? 30,
                maxMessageSize: partial.messenger?.maxMessageSize ?? 10485760,
                bandwidthCapacity: partial.messenger?.bandwidthCapacity ?? 50000000,
                messageStorage: partial.messenger?.messageStorage ?? 1073741824,
                maxConnections: partial.messenger?.maxConnections ?? 50
            }
        };
    }
    getConfig() { return { ...this.config }; }
    async saveConfig() {
        const configDir = path.dirname(this.configPath);
        await fs.mkdir(configDir, { recursive: true });
        await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2));
    }
    async loadConfig() {
        try {
            const configData = await fs.readFile(this.configPath, 'utf-8');
            const config = JSON.parse(configData);
            return new ConfigurationManager(config, this.configPath);
        }
        catch (error) {
            console.warn('Could not load config file, using defaults:', error);
            return this;
        }
    }
    static async fromFile(configPath) {
        const manager = new ConfigurationManager({}, configPath);
        return await manager.loadConfig();
    }
    static fromEnvironment() {
        return new ConfigurationManager({
            node: {
                type: process.env.G3ZKP_NODE_TYPE || 'peer',
                id: process.env.G3ZKP_NODE_ID || `node_${Date.now()}`,
                version: '1.0.0',
                capabilities: ['messaging', 'zkp', 'p2p'],
                publicKey: new Uint8Array(32)
            },
            network: {
                mode: process.env.G3ZKP_NETWORK_MODE || 'local',
                bootstrapNodes: [],
                enableRelay: false,
                enableNatTraversal: false,
                maxConnections: parseInt(process.env.G3ZKP_MAX_CONNECTIONS || "50"),
                connectionTimeout: 30000,
                localPort: parseInt(process.env.G3ZKP_LOCAL_PORT || "4001"),
                httpPort: parseInt(process.env.G3ZKP_HTTP_PORT || "3000"),
                metricsPort: parseInt(process.env.G3ZKP_METRICS_PORT || "9090")
            },
            storage: {
                messageRetentionDays: 30,
                maxMessageSize: 10485760,
                enableEphemeral: false,
                cacheSize: 1000,
                encryptAtRest: true,
                dataPath: process.env.G3ZKP_DATA_PATH || "./data"
            }
        });
    }
}
