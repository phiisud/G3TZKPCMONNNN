import React, { useState } from 'react';
import { MessageSquare, Send, X, CheckCircle, AlertCircle, Star } from 'lucide-react';

interface FeedbackDialogProps {
  onClose: () => void;
}

export function FeedbackDialog({ onClose }: FeedbackDialogProps) {
  const [feedbackType, setFeedbackType] = useState<'bug' | 'feature' | 'improvement' | 'other'>('bug');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [rating, setRating] = useState(0);
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !description.trim()) {
      setError('Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const feedback = {
        type: feedbackType,
        title: title.trim(),
        description: description.trim(),
        rating,
        email: email.trim() || undefined,
        userAgent: navigator.userAgent,
        screenResolution: `${window.screen.width}x${window.screen.height}`,
        language: navigator.language,
        url: window.location.href
      };

      // If running in Electron, use electronAPI
      if (window.electronAPI) {
        const result = await window.electronAPI.submitFeedback(feedback);
        if (result.success) {
          setSubmitted(true);
          setTimeout(() => {
            onClose();
          }, 2000);
        } else {
          setError(result.error || 'Failed to submit feedback');
        }
      } else {
        // Web version - send to server
        const response = await fetch('/api/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(feedback)
        });

        if (response.ok) {
          setSubmitted(true);
          setTimeout(() => {
            onClose();
          }, 2000);
        } else {
          throw new Error('Failed to submit feedback');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to submit feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
        <div className="bg-black border border-green-500/30 max-w-md w-full rounded-lg p-8 text-center">
          <CheckCircle size={48} className="text-green-400 mx-auto mb-4" />
          <h2 className="text-green-400 font-mono text-lg mb-2">Feedback Submitted!</h2>
          <p className="text-gray-400 text-sm font-mono">Thank you for helping us improve G3ZKP Messenger.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 safe-top safe-bottom">
      <div className="bg-black border border-cyan-500/30 max-w-2xl w-full rounded-lg overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-cyan-900/20 border-b border-cyan-500/30 p-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <MessageSquare size={20} className="text-cyan-400" />
            <h2 className="text-cyan-400 font-mono text-sm uppercase tracking-wider">
              Send Feedback
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Feedback Type */}
          <div>
            <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">
              Type
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { value: 'bug', label: 'Bug Report', color: 'red' },
                { value: 'feature', label: 'Feature Request', color: 'blue' },
                { value: 'improvement', label: 'Improvement', color: 'yellow' },
                { value: 'other', label: 'Other', color: 'gray' }
              ].map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setFeedbackType(type.value as any)}
                  className={`px-3 py-2 border text-xs font-mono uppercase tracking-wider transition-all ${
                    feedbackType === type.value
                      ? `border-${type.color}-500/50 bg-${type.color}-900/20 text-${type.color}-400`
                      : 'border-gray-700 bg-gray-900/20 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* Rating */}
          <div>
            <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">
              Overall Rating (Optional)
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRating(value)}
                  className="transition-colors"
                >
                  <Star
                    size={24}
                    className={rating >= value ? 'fill-yellow-400 text-yellow-400' : 'text-gray-600'}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-xs text-gray-400 uppercase tracking-wider mb-2">
              Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Brief summary of your feedback"
              className="w-full bg-gray-900/50 border border-gray-700 text-white px-4 py-2 text-sm font-mono focus:border-cyan-500/50 focus:outline-none transition-colors"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-xs text-gray-400 uppercase tracking-wider mb-2">
              Description <span className="text-red-400">*</span>
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detailed description of your feedback. For bugs, please include steps to reproduce."
              rows={6}
              className="w-full bg-gray-900/50 border border-gray-700 text-white px-4 py-2 text-sm font-mono focus:border-cyan-500/50 focus:outline-none transition-colors resize-none"
              required
            />
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-xs text-gray-400 uppercase tracking-wider mb-2">
              Email (Optional)
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="If you'd like us to follow up with you"
              className="w-full bg-gray-900/50 border border-gray-700 text-white px-4 py-2 text-sm font-mono focus:border-cyan-500/50 focus:outline-none transition-colors"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-900/20 border border-red-500/30 rounded p-3 flex items-center gap-3">
              <AlertCircle size={16} className="text-red-400 shrink-0" />
              <span className="text-red-400 text-xs font-mono">{error}</span>
            </div>
          )}

          {/* Privacy Note */}
          <div className="bg-cyan-900/10 border border-cyan-500/20 rounded p-3">
            <p className="text-xs text-gray-400 font-mono">
              Your feedback helps us improve. We collect basic system information (browser, OS, screen resolution) to help diagnose issues. No personal data is collected unless you provide it.
            </p>
          </div>
        </form>

        {/* Actions */}
        <div className="border-t border-cyan-500/30 p-4 flex gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-600 text-gray-400 hover:bg-gray-800 transition-all text-xs font-mono uppercase tracking-wider"
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 px-4 py-2 bg-cyan-600 text-white hover:bg-cyan-500 transition-all text-xs font-mono uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send size={14} />
                Submit Feedback
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default FeedbackDialog;
