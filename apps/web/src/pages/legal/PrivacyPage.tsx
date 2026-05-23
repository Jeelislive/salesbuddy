import { Link } from 'react-router-dom';
import { Zap, ArrowLeft } from 'lucide-react';

export function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="border-b border-border px-6 py-4 flex items-center justify-between max-w-4xl mx-auto">
        <Link to="/" className="flex items-center gap-2 font-semibold text-foreground">
          <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-white" />
          </div>
          SalesBuddy
        </Link>
        <Link to="/" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </Link>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-foreground mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-10">Last updated: May 23, 2026</p>

        <div className="prose prose-sm max-w-none space-y-8 text-foreground">

          <section>
            <h2 className="text-lg font-semibold mb-3">1. Overview</h2>
            <p className="text-muted-foreground leading-relaxed">
              SalesBuddy ("we", "us", or "our") is an AI-powered sales automation platform. This Privacy Policy explains how we collect, use, and protect information when you use our service at <strong>salewithai.vercel.app</strong>. By using SalesBuddy, you agree to the practices described in this policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">2. Information We Collect</h2>
            <div className="space-y-3 text-muted-foreground">
              <p><strong className="text-foreground">Account information:</strong> When you sign in with Google, we receive your name, email address, and profile picture from Google.</p>
              <p><strong className="text-foreground">Gmail access:</strong> If you connect your Gmail account for email outreach, we request permission to send emails on your behalf using the <code className="bg-muted px-1 py-0.5 rounded text-xs">gmail.send</code> scope. We do not read, store, or access any emails in your inbox.</p>
              <p><strong className="text-foreground">Lead data:</strong> Contact information (names, email addresses, company names, job titles) that you import, discover, or manually enter.</p>
              <p><strong className="text-foreground">Usage data:</strong> How you interact with the platform (pages visited, features used) to improve the product.</p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">3. How We Use Your Information</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Authenticate you and provide access to your workspace</li>
              <li>Send emails through your connected Gmail account on your behalf</li>
              <li>Store and manage leads, deals, and sequences within your workspace</li>
              <li>Run AI-powered features (lead scoring, email generation, GitHub discovery)</li>
              <li>Improve and debug the platform</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">4. Google API Usage</h2>
            <p className="text-muted-foreground leading-relaxed">
              SalesBuddy uses the Google Gmail API solely to send emails on your behalf when you have connected your Gmail account. Our use and transfer of information received from Google APIs to any other app adheres to the <a href="https://developers.google.com/terms/api-services-user-data-policy" className="text-primary underline" target="_blank" rel="noopener noreferrer">Google API Services User Data Policy</a>, including the Limited Use requirements.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-2">
              We do not use Gmail data for advertising, do not allow humans to read your Gmail data, and do not share Gmail data with third parties except as necessary to operate the service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">5. Data Storage & Security</h2>
            <p className="text-muted-foreground leading-relaxed">
              Your data is stored in Supabase (PostgreSQL), a secure cloud database. Gmail OAuth tokens are encrypted using AES-256-GCM before storage and are never exposed in plaintext. We use HTTPS for all data in transit.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">6. Data Sharing</h2>
            <p className="text-muted-foreground leading-relaxed">
              We do not sell, rent, or share your personal data with third parties for marketing purposes. We may share data only with service providers necessary to operate SalesBuddy (Supabase for database, Anthropic for AI features, Google for Gmail integration). All providers are bound by confidentiality agreements.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">7. Data Retention & Deletion</h2>
            <p className="text-muted-foreground leading-relaxed">
              You can delete your account and all associated data at any time from the Settings page. Upon deletion, your workspace data, leads, and connected account tokens are permanently removed within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">8. Your Rights</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Disconnect your Google account at any time from Settings</li>
              <li>Revoke Gmail access from your <a href="https://myaccount.google.com/permissions" className="text-primary underline" target="_blank" rel="noopener noreferrer">Google Account permissions</a></li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">9. Contact</h2>
            <p className="text-muted-foreground leading-relaxed">
              For privacy-related questions or data requests, contact us at:{' '}
              <a href="mailto:jeelrupareliya255@gmail.com" className="text-primary underline">
                jeelrupareliya255@gmail.com
              </a>
            </p>
          </section>

        </div>
      </main>

      <footer className="border-t border-border mt-16 py-6 text-center text-xs text-muted-foreground">
        © 2026 SalesBuddy. All rights reserved.
      </footer>
    </div>
  );
}
