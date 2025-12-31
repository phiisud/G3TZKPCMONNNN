// Mock for missing libp2p utils - only for globalThis unicast functions
export const getGlobalThisUnicastIp = () => {
  return '127.0.0.1';
};

export default { getGlobalThisUnicastIp };