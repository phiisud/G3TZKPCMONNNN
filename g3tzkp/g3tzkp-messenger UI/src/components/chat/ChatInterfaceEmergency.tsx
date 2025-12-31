import { emergencyMessagingService } from '@/services/EmergencyMessagingService';
import { g3tzkpService } from '@/services/G3TZKPService';
import { useState, useEffect } from 'react';

export const ChatInterfaceEmergency: React.FC = () => {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('🔄 Connecting...');
  const [recipientId, setRecipientId] = useState('');

  useEffect(() => {
    const checkConnection = async () => {
      const emergencyReady = emergencyMessagingService.isReady();
      const g3tzkpReady = g3tzkpService.isInitialized();

      if (emergencyReady) {
        setConnectionStatus(`✅ Emergency: ${emergencyMessagingService.getCurrentTransport()}`);
      } else if (g3tzkpReady) {
        setConnectionStatus('✅ G3TZKP P2P Connected');
      } else {
        setConnectionStatus('⏳ Offline (Messages Queued)');
      }
    };

    checkConnection();
    const interval = setInterval(checkConnection, 2000);
    return () => clearInterval(interval);
  }, []);

  const sendMessage = async () => {
    if (!message.trim() || !recipientId.trim() || isSending) return;

    setIsSending(true);
    console.log(`🚀 SENDING: "${message}" to ${recipientId}`);

    try {
      let success = false;

      if (emergencyMessagingService.isReady()) {
        success = await emergencyMessagingService.sendMessageNow(recipientId, message);
      } else if (g3tzkpService.getPeerId()) {
        await g3tzkpService.sendMessage(recipientId, message);
        success = true;
      }

      const status = success ? 'sent' : 'queued';

      setMessages(prev => [
        ...prev,
        {
          id: Date.now(),
          text: message,
          sender: 'me',
          timestamp: new Date(),
          status
        }
      ]);

      setMessage('');
      if (!success) {
        alert('⚠️ Message queued - will send when connection restored');
      }
    } catch (error) {
      console.error('❌ Send failed:', error);
      alert('❌ Message failed. Check connection.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="chat-emergency-container">
      <div className="chat-header">
        <h2>G3ZKP Emergency Messenger</h2>
        <div className="connection-status">{connectionStatus}</div>
        <div className="queue-status">
          Queue: {emergencyMessagingService.getQueueSize()} messages
        </div>
      </div>

      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="empty-state">No messages yet</div>
        ) : (
          messages.map(msg => (
            <div key={msg.id} className={`message ${msg.sender}`}>
              <div className="message-text">{msg.text}</div>
              <div className="message-meta">
                <span className="timestamp">
                  {msg.timestamp.toLocaleTimeString()}
                </span>
                <span className={`status ${msg.status}`}>
                  {msg.status === 'sent' ? '✅' : '⏳'} {msg.status}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="chat-input-section">
        <div className="recipient-input">
          <label>Recipient Peer ID:</label>
          <input
            type="text"
            value={recipientId}
            onChange={e => setRecipientId(e.target.value)}
            placeholder="Paste peer ID here..."
            className="recipient-field"
          />
        </div>

        <div className="message-input-group">
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Type message here... (Ctrl+Enter to send)"
            onKeyDown={e => {
              if (e.ctrlKey && e.key === 'Enter') {
                sendMessage();
              }
            }}
            disabled={isSending}
            className="message-textarea"
          />

          <button
            onClick={sendMessage}
            disabled={isSending || !message.trim() || !recipientId.trim()}
            className="send-button"
          >
            {isSending ? '⏳ Sending...' : '📤 Send'}
          </button>
        </div>

        <div className="transport-info">
          <p>
            <strong>Transport:</strong> {emergencyMessagingService.getCurrentTransport()}
          </p>
          <p>
            <strong>Queued Messages:</strong> {emergencyMessagingService.getQueueSize()}
          </p>
        </div>
      </div>
    </div>
  );
};
