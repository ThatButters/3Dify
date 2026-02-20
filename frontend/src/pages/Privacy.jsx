import { Link } from 'react-router-dom';

export default function Privacy() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12 page-enter">
      <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-sm text-[var(--color-muted-2)] mb-8">Last updated: February 2026</p>

      <div className="space-y-8 text-sm text-[var(--color-muted)] leading-relaxed">
        <section>
          <h2 className="text-base font-semibold text-white mb-2">The Short Version</h2>
          <p>
            We collect the bare minimum to make the service work. We don't sell your data.
            We don't want your data. We barely want to maintain a database.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white mb-2">What We Collect</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong className="text-white">Your IP address</strong> — used for rate limiting (20 jobs/day)
              and abuse prevention. That's it.
            </li>
            <li>
              <strong className="text-white">Uploaded images</strong> — processed by the AI pipeline and
              automatically deleted within 72 hours.
            </li>
            <li>
              <strong className="text-white">Generated models</strong> — STL and GLB files stored temporarily
              for download, automatically deleted within 72 hours.
            </li>
            <li>
              <strong className="text-white">Job metadata</strong> — status, timestamps, vertex counts, and
              generation settings. Used for the queue system and admin monitoring.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white mb-2">What We Don't Collect</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>No accounts, no usernames, no passwords (except admin)</li>
            <li>No email addresses</li>
            <li>No tracking cookies or analytics scripts</li>
            <li>No personal information of any kind</li>
          </ul>
          <p className="mt-2">
            We literally cannot email you even if we wanted to. We don't know who you are.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white mb-2">Data Sharing</h2>
          <p>
            We do not sell, share, trade, rent, or otherwise distribute your data to anyone.
            Not to advertisers. Not to data brokers. Not to that guy who keeps asking.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white mb-2">Public Gallery</h2>
          <p>
            If you submit a model to the public gallery, the 3D model becomes visible to other users.
            No personal information is attached — no IP, no filename, no metadata that identifies you.
            Just the model.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white mb-2">Content Reports</h2>
          <p>
            If you report content, we log the report for moderation purposes. This includes the
            job ID and the reason you provided. Reports are reviewed by the admin (one person)
            and handled accordingly.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white mb-2">DMCA Requests</h2>
          <p>
            We comply with DMCA takedown requests. If you believe copyrighted content has been uploaded,
            contact{' '}
            <a href="mailto:beeman82@gmail.com" className="text-[var(--color-accent)] hover:text-white transition-colors">
              beeman82@gmail.com
            </a>{' '}
            with details and the job ID if available.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white mb-2">Privacy Requests</h2>
          <p>
            If you have questions about your data or want something removed, contact{' '}
            <a href="mailto:beeman82@gmail.com" className="text-[var(--color-accent)] hover:text-white transition-colors">
              beeman82@gmail.com
            </a>.
            Given that we auto-delete everything in 72 hours and don't know who you are,
            there's a good chance the problem will solve itself.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white mb-2">Changes</h2>
          <p>
            This policy is subject to change at any time, on a whim. Check back occasionally
            if you're the kind of person who reads privacy policies. We respect that energy.
          </p>
        </section>
      </div>

      <div className="mt-10 pt-6 border-t border-[var(--color-border)] flex items-center justify-between text-sm">
        <Link to="/terms" className="text-[var(--color-accent)] hover:text-white transition-colors">
          Terms of Use
        </Link>
        <Link to="/" className="text-[var(--color-muted)] hover:text-white transition-colors">
          Back to home
        </Link>
      </div>
    </div>
  );
}
