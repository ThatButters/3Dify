import { Link } from 'react-router-dom';

export default function Terms() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12 page-enter">
      <h1 className="text-3xl font-bold mb-2">Terms of Use</h1>
      <p className="text-sm text-[var(--color-muted-2)] mb-8">Last updated: February 2026</p>

      <div className="space-y-8 text-sm text-[var(--color-muted)] leading-relaxed">
        <section>
          <h2 className="text-base font-semibold text-white mb-2">The Short Version</h2>
          <p>
            3Dify is a free, open-source tool that converts photos into 3D-printable STL files.
            It runs on a guy's home GPU. Don't be weird about it.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white mb-2">Service Provided As-Is</h2>
          <p>
            This service is provided free of charge, as-is, with no warranties or guarantees of any kind.
            We make no promises about uptime, accuracy, quality, or availability. The GPU might be busy.
            The server might be down. The model might hallucinate your cat into a lovecraftian horror.
            That's the deal.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white mb-2">Acceptable Use</h2>
          <p className="mb-2">By using 3Dify, you agree not to upload:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>NSFW or sexually explicit content</li>
            <li>Illegal content of any kind</li>
            <li>Copyrighted material you don't own or have rights to</li>
            <li>Content intended to harass, threaten, or harm others</li>
          </ul>
          <p className="mt-2">
            We reserve the right to remove content and block IPs that violate these terms,
            at our sole discretion, without notice.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white mb-2">Rate Limits</h2>
          <p>
            Usage is limited to 20 jobs per day per IP address. This isn't a suggestion — the server
            enforces it. If you need more, run the{' '}
            <a href="https://github.com/ThatButters/3Dify" target="_blank" rel="noopener noreferrer" className="text-[var(--color-accent)] hover:text-white transition-colors">
              open-source code
            </a>{' '}
            yourself.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white mb-2">Data Retention</h2>
          <p>
            Uploaded images and generated models are automatically deleted after 72 hours.
            This is not a storage service. Download your STL when it's ready. If you come back
            a week later and it's gone, that's on you.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white mb-2">Your Models, Your Problem</h2>
          <p>
            Once you download an STL file, what you do with it is your business.
            We are not responsible for how printed models are used — whether you print a
            bust of your neighbor, a replacement part for your dishwasher, or something
            that gets you banned from the local makerspace.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white mb-2">Availability</h2>
          <p>
            This service may go down at any time. It runs on a guy's home GPU. If the power goes out,
            if Windows decides to update, or if the GPU gets tired, the service stops.
            There is no SLA. There is no support ticket system. There is a dude who will
            probably notice eventually.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white mb-2">DMCA</h2>
          <p>
            If you believe your copyrighted work has been uploaded to 3Dify without your permission,
            contact us at{' '}
            <a href="mailto:beeman82@gmail.com" className="text-[var(--color-accent)] hover:text-white transition-colors">
              beeman82@gmail.com
            </a>{' '}
            with the job ID (if you have it) and details about the copyrighted work.
            We will review and respond to valid takedown requests.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white mb-2">Changes</h2>
          <p>
            Everything here is subject to change at any time, for any reason, on a whim.
            By using the service you agree to these terms, whatever they happen to be today.
            We won't send you an email about it because we don't have your email.
          </p>
        </section>
      </div>

      <div className="mt-10 pt-6 border-t border-[var(--color-border)] flex items-center justify-between text-sm">
        <Link to="/privacy" className="text-[var(--color-accent)] hover:text-white transition-colors">
          Privacy Policy
        </Link>
        <Link to="/" className="text-[var(--color-muted)] hover:text-white transition-colors">
          Back to home
        </Link>
      </div>
    </div>
  );
}
