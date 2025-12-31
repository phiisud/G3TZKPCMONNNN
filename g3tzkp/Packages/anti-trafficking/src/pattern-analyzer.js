// G3ZKP Pattern Analyzer for Anti-Trafficking Detection
// Analyzes communication patterns while preserving privacy
export class PatternAnalyzer {
    initialized = false;
    patternCache = new Map();
    async initialize() {
        if (this.initialized)
            return;
        // Initialize Pattern Analyzer
        this.initialized = true;
    }
    async extractPatterns(messageData) {
        if (!this.initialized) {
            await this.initialize();
        }
        const userId = messageData.senderId;
        // Get or create pattern for this user
        let patterns = this.patternCache.get(userId);
        if (!patterns) {
            patterns = this.createInitialPattern();
        }
        // Update patterns with new message data
        patterns = await this.updatePatterns(patterns, messageData);
        // Cache the updated patterns
        this.patternCache.set(userId, patterns);
        return patterns;
    }
    async analyzePatternProgression(userId) {
        const patterns = this.patternCache.get(userId);
        if (!patterns) {
            return {
                trend: 'stable',
                riskProgression: 0,
                recommendations: ['No pattern data available for analysis']
            };
        }
        // Analyze trend in suspicious patterns
        const riskIndicators = this.calculateRiskIndicators(patterns);
        const trend = this.determineTrend(riskIndicators);
        const riskProgression = this.calculateRiskProgression(riskIndicators);
        const recommendations = this.generateRecommendations(riskIndicators, trend);
        return {
            trend,
            riskProgression,
            recommendations
        };
    }
    async getPatternSummary(userId) {
        const patterns = this.patternCache.get(userId);
        if (!patterns) {
            return {
                userId,
                status: 'No pattern data available',
                riskLevel: 'unknown'
            };
        }
        const riskLevel = this.calculateOverallRisk(patterns);
        return {
            userId,
            status: this.determineStatus(patterns),
            riskLevel,
            patternCount: this.countActivePatterns(patterns),
            lastUpdate: new Date(),
            topRiskFactors: this.identifyTopRiskFactors(patterns)
        };
    }
    createInitialPattern() {
        return {
            metadata: {
                exifStripped: false,
                deviceInconsistencies: 0,
                timestampAnomalies: 0,
                locationRemoved: false,
                fileTypes: [],
                compressionPatterns: []
            },
            storage: {
                encryptedContainers: 0,
                externalDriveAccess: 0,
                archiveCreation: 0,
                keyExchangeFrequency: 0,
                cloudIntegration: 0,
                backupPatterns: [],
                largeFileTransfers: 0
            },
            repository: {
                largeFileTransfers: 0,
                documentSharing: 0,
                persistentStorage: 0,
                repositoryTypes: [],
                sharingPatterns: []
            },
            account: {
                anonymousAccounts: 0,
                temporaryEmailUsage: 0,
                crossPlatformAccess: 0,
                abandonmentCycles: 0,
                registrationPatterns: []
            },
            ephemeral: {
                autoDeletionFrequency: 0,
                fileExpiration: 0,
                accountWiping: 0,
                communicationGaps: 0,
                deletionPatterns: []
            }
        };
    }
    async updatePatterns(patterns, messageData) {
        // Update metadata patterns
        if (messageData.fileSize) {
            patterns.metadata.fileTypes = this.updateFileTypes(patterns.metadata.fileTypes, messageData.fileType);
        }
        if (messageData.exifData === null) {
            patterns.metadata.exifStripped = true;
        }
        // Update storage patterns
        if (messageData.hasAttachments) {
            patterns.storage.largeFileTransfers += messageData.fileSize > 100 * 1024 * 1024 ? 1 : 0;
        }
        // Update ephemeral patterns
        if (messageData.autoDelete) {
            patterns.ephemeral.autoDeletionFrequency++;
        }
        // Update account patterns based on registration info
        if (messageData.registrationData) {
            this.updateAccountPatterns(patterns.account, messageData.registrationData);
        }
        return patterns;
    }
    updateFileTypes(existingTypes, newType) {
        if (!existingTypes.includes(newType)) {
            return [...existingTypes, newType];
        }
        return existingTypes;
    }
    updateAccountPatterns(account, registrationData) {
        if (registrationData.emailProvider && this.isTemporaryEmail(registrationData.emailProvider)) {
            account.temporaryEmailUsage++;
        }
        if (registrationData.anonymousRegistration) {
            account.anonymousAccounts++;
        }
    }
    isTemporaryEmail(provider) {
        const temporaryProviders = ['10minutemail', 'guerrillamail', 'tempmail', 'throwaway'];
        return temporaryProviders.some(temp => provider.toLowerCase().includes(temp));
    }
    calculateRiskIndicators(patterns) {
        return {
            metadataRisk: this.calculateMetadataRisk(patterns.metadata),
            storageRisk: this.calculateStorageRisk(patterns.storage),
            repositoryRisk: this.calculateRepositoryRisk(patterns.repository),
            accountRisk: this.calculateAccountRisk(patterns.account),
            ephemeralRisk: this.calculateEphemeralRisk(patterns.ephemeral)
        };
    }
    calculateMetadataRisk(metadata) {
        let risk = 0;
        if (metadata.exifStripped)
            risk += 0.3;
        if (metadata.deviceInconsistencies > 3)
            risk += 0.2;
        if (metadata.timestampAnomalies > 2)
            risk += 0.2;
        if (metadata.locationRemoved)
            risk += 0.1;
        return Math.min(risk, 1.0);
    }
    calculateStorageRisk(storage) {
        let risk = 0;
        if (storage.encryptedContainers > 0)
            risk += 0.3;
        if (storage.externalDriveAccess > 2)
            risk += 0.2;
        if (storage.archiveCreation > 3)
            risk += 0.2;
        if (storage.keyExchangeFrequency > 5)
            risk += 0.2;
        return Math.min(risk, 1.0);
    }
    calculateRepositoryRisk(repository) {
        let risk = 0;
        if (repository.largeFileTransfers > 10)
            risk += 0.3;
        if (repository.documentSharing > 5)
            risk += 0.3;
        if (repository.persistentStorage > 7)
            risk += 0.2;
        return Math.min(risk, 1.0);
    }
    calculateAccountRisk(account) {
        let risk = 0;
        if (account.anonymousAccounts > 1)
            risk += 0.4;
        if (account.temporaryEmailUsage > 2)
            risk += 0.3;
        if (account.abandonmentCycles > 2)
            risk += 0.3;
        return Math.min(risk, 1.0);
    }
    calculateEphemeralRisk(ephemeral) {
        let risk = 0;
        if (ephemeral.autoDeletionFrequency > 5)
            risk += 0.4;
        if (ephemeral.accountWiping > 0)
            risk += 0.5;
        if (ephemeral.communicationGaps > 2)
            risk += 0.2;
        return Math.min(risk, 1.0);
    }
    determineTrend(riskIndicators) {
        // Simplified trend analysis - would need historical data for real implementation
        const totalRisk = Object.values(riskIndicators).reduce((sum, risk) => sum + risk, 0) / 5;
        if (totalRisk > 0.6)
            return 'increasing';
        if (totalRisk < 0.2)
            return 'decreasing';
        return 'stable';
    }
    calculateRiskProgression(riskIndicators) {
        // Calculate progression score based on risk indicators
        return Object.values(riskIndicators).reduce((sum, risk) => sum + risk, 0) / 5;
    }
    generateRecommendations(riskIndicators, trend) {
        const recommendations = [];
        if (riskIndicators.metadataRisk > 0.5) {
            recommendations.push('Investigate metadata manipulation patterns');
        }
        if (riskIndicators.storageRisk > 0.5) {
            recommendations.push('Monitor encrypted storage and archive creation');
        }
        if (riskIndicators.ephemeralRisk > 0.5) {
            recommendations.push('Review auto-deletion and account wiping patterns');
        }
        if (trend === 'increasing') {
            recommendations.push('Escalate monitoring due to increasing risk trend');
        }
        return recommendations;
    }
    calculateOverallRisk(patterns) {
        const riskIndicators = this.calculateRiskIndicators(patterns);
        const averageRisk = Object.values(riskIndicators).reduce((sum, risk) => sum + risk, 0) / 5;
        if (averageRisk > 0.7)
            return 'high';
        if (averageRisk > 0.4)
            return 'medium';
        if (averageRisk > 0.2)
            return 'low';
        return 'minimal';
    }
    determineStatus(patterns) {
        const totalPatterns = this.countActivePatterns(patterns);
        if (totalPatterns > 10)
            return 'high_activity';
        if (totalPatterns > 5)
            return 'moderate_activity';
        if (totalPatterns > 0)
            return 'low_activity';
        return 'no_activity';
    }
    countActivePatterns(patterns) {
        let count = 0;
        // Count active metadata patterns
        if (patterns.metadata.exifStripped)
            count++;
        count += patterns.metadata.deviceInconsistencies;
        count += patterns.metadata.timestampAnomalies;
        // Count active storage patterns
        count += patterns.storage.encryptedContainers;
        count += patterns.storage.externalDriveAccess;
        count += patterns.storage.archiveCreation;
        // Count active repository patterns
        count += patterns.repository.largeFileTransfers;
        count += patterns.repository.documentSharing;
        // Count active account patterns
        count += patterns.account.anonymousAccounts;
        count += patterns.account.temporaryEmailUsage;
        // Count active ephemeral patterns
        count += patterns.ephemeral.autoDeletionFrequency;
        count += patterns.ephemeral.accountWiping;
        return count;
    }
    identifyTopRiskFactors(patterns) {
        const risks = this.calculateRiskIndicators(patterns);
        const riskEntries = Object.entries(risks)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3);
        return riskEntries.map(([key]) => `${key}_risk`);
    }
}
