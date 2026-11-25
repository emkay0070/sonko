import React, { useState } from 'react';
import { Check, Mail, Send } from 'lucide-react';
import { Link } from '../router';

const TOPICS = [
  'Support',
  'Privacy / Ad Preferences',
  'Copyright / Creator Studio',
  'Business & Press',
] as const;

export function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [topic, setTopic] = useState<string>('Support');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ status: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedMessage = message.trim();

    if (trimmedName.length < 2) {
      setFeedback({ status: 'error', text: 'Please enter your name (at least 2 characters).' });
      return;
    }
    if (!/^[^\s@<>]{1,64}@[^\s@<>]{1,190}\.[^\s@<>]{2,32}$/.test(trimmedEmail)) {
      setFeedback({ status: 'error', text: 'Please provide a valid email address.' });
      return;
    }
    if (trimmedMessage.length < 10) {
      setFeedback({ status: 'error', text: 'Please enter a message of at least 10 characters.' });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          name: trimmedName,
          email: trimmedEmail,
          topic,
          message: trimmedMessage,
        }),
      });

      const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (res.ok && body?.ok) {
        setFeedback({
          status: 'success',
          text: 'Thank you! Your message has been received by the Sonko team.',
        });
        setName('');
        setEmail('');
        setTopic('Support');
        setMessage('');
        return;
      }

      if (res.status >= 400 && res.status < 500 && body?.error) {
        setFeedback({ status: 'error', text: body.error });
        return;
      }

      // Graceful fallback when running on static hosting without the Express API backend
      setFeedback({
        status: 'error',
        text: 'Direct form delivery is unavailable on this static host. Please email support@sonkogame.com directly.',
      });
    } catch {
      setFeedback({
        status: 'error',
        text: 'Network error while sending message. Please email support@sonkogame.com directly.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <header className="border-b border-[#FAF3E8]/12 pb-8 mb-10">
        <p className="text-xs font-semibold text-amber-400 tracking-wide mb-2">
          Publisher Support
        </p>
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-[#FAF3E8] tracking-tight">
          Contact Us
        </h1>
        <p className="text-sm text-[#E5D3BE]/75 mt-2">
          We respond to gameplay support, privacy, and licensing inquiries within 2–3 business days.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-5 flex flex-col gap-5 rounded-xl border border-[#FAF3E8]/12 bg-[#24120C] p-6">
          <h2 className="font-display text-xl font-bold text-[#FDE68A]">Direct Support Channels</h2>
          <p className="text-sm text-[#E5D3BE]/85 leading-relaxed">
            Questions about gameplay, bug reports, privacy rights, AdSense compliance, or Creator
            Studio 3D uploads? Reach our publishing team directly by email or use the message form.
          </p>

          <div className="border-t border-[#FAF3E8]/10 pt-4 flex flex-col gap-2">
            <span className="text-xs font-medium text-[#E5D3BE]/70">Support Email</span>
            <a
              href="mailto:support@sonkogame.com"
              className="inline-flex items-center gap-2 text-sm font-semibold text-amber-300 hover:text-amber-200 underline underline-offset-4"
            >
              <Mail className="w-4 h-4" aria-hidden="true" />
              <span>support@sonkogame.com</span>
            </a>
          </div>

          <div className="border-t border-[#FAF3E8]/10 pt-4 flex flex-col gap-1.5 text-xs text-[#E5D3BE]/75">
            <span>Helpful References</span>
            <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
              <Link to="/privacy" className="text-amber-300 hover:text-amber-200 underline underline-offset-2">
                Privacy Policy
              </Link>
              <Link to="/terms" className="text-amber-300 hover:text-amber-200 underline underline-offset-2">
                Terms of Use
              </Link>
              <Link to="/how-to-play" className="text-amber-300 hover:text-amber-200 underline underline-offset-2">
                How to Play
              </Link>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 rounded-xl border border-[#FAF3E8]/12 bg-[#24120C] p-6 sm:p-7">
          <h2 className="font-display text-xl font-bold text-[#FDE68A] mb-4">Send a Message</h2>

          {feedback && (
            <div
              role="status"
              className={`mb-5 px-4 py-3 rounded-lg border text-sm font-medium flex items-start gap-2.5 ${
                feedback.status === 'success'
                  ? 'bg-emerald-950/50 border-emerald-400/45 text-emerald-200'
                  : 'bg-red-950/50 border-red-400/45 text-red-200'
              }`}
            >
              {feedback.status === 'success' && (
                <Check className="w-4 h-4 text-emerald-300 shrink-0 mt-0.5" aria-hidden="true" />
              )}
              <span>{feedback.text}</span>
            </div>
          )}

          <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4" noValidate>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5 text-xs font-semibold text-[#E5D3BE]">
                <span>Your Name</span>
                <input
                  type="text"
                  name="name"
                  required
                  minLength={2}
                  maxLength={80}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Namono Sarah"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#140906] border border-[#FAF3E8]/20 text-sm font-normal text-[#FAF3E8] placeholder:text-[#E5D3BE]/35 focus:outline-2 focus:outline-amber-400"
                />
              </label>

              <label className="flex flex-col gap-1.5 text-xs font-semibold text-[#E5D3BE]">
                <span>Email Address</span>
                <input
                  type="email"
                  name="email"
                  required
                  maxLength={160}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#140906] border border-[#FAF3E8]/20 text-sm font-normal text-[#FAF3E8] placeholder:text-[#E5D3BE]/35 focus:outline-2 focus:outline-amber-400"
                />
              </label>
            </div>

            <label className="flex flex-col gap-1.5 text-xs font-semibold text-[#E5D3BE]">
              <span>Topic</span>
              <select
                name="topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#140906] border border-[#FAF3E8]/20 text-sm font-normal text-[#FAF3E8] focus:outline-2 focus:outline-amber-400"
              >
                {TOPICS.map((t) => (
                  <option key={t} value={t} className="bg-[#1B0D08] text-[#FAF3E8]">
                    {t}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5 text-xs font-semibold text-[#E5D3BE]">
              <span>Message</span>
              <textarea
                name="message"
                required
                minLength={10}
                maxLength={2000}
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell us how we can help..."
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#140906] border border-[#FAF3E8]/20 text-sm font-normal text-[#FAF3E8] placeholder:text-[#E5D3BE]/35 focus:outline-2 focus:outline-amber-400"
              />
            </label>

            <div className="pt-1">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-[#F59E0B] hover:bg-[#FBBF24] disabled:opacity-60 text-[#1A0B07] font-display font-bold text-sm transition-colors cursor-pointer disabled:cursor-wait"
              >
                <Send className="w-4 h-4" aria-hidden="true" />
                <span>{submitting ? 'Sending...' : 'Send Message'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </article>
  );
}
