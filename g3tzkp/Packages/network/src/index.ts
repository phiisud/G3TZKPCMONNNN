export { G3ZKPNetworkEngine } from './network-engine';
export { PeerDiscoveryService } from './peer-discovery';
export { MessageRouter } from './message-router';

export type {
  NetworkConfig,
  PeerInfo,
  MessageReceipt,
  NetworkStats
} from './network-engine';

export type {
  DiscoveredPeer,
  DiscoveryConfig,
  PeerScoreFactors
} from './peer-discovery';

export type {
  RouteEntry,
  RoutedMessage,
  RoutingStats,
  RouterConfig
} from './message-router';
