import { Navbar } from '@/components/shared/navbar';
import { Footer } from '@/components/shared/footer';

export default function PrivacyPage() {
  return (
    <div className="bg-slate-50">
      <Navbar />

      <section className="mx-auto max-w-5xl px-6 pb-20 pt-16">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
          <div className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-700">
            Privacy Policy
          </div>

          <h1 className="mt-4 text-5xl font-bold tracking-tight text-slate-950 sm:text-6xl">
            Privacy at Wezen Staffing
          </h1>

          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-600">
            Wezen Staffing is committed to protecting the privacy of facilities,
            professionals, and platform users. This page explains the types of
            information we collect, how we use it, and how we protect it.
          </p>

          <div className="mt-12 space-y-10">
            <section>
              <h2 className="text-2xl font-bold tracking-tight text-slate-950">
                Information We Collect
              </h2>
              <div className="mt-4 space-y-4 text-base leading-8 text-slate-600">
                <p>
                  We may collect information you provide directly, including account
                  details, contact information, onboarding information, compliance
                  documents, shift requests, and operational data needed to use the platform.
                </p>
                <p>
                  For professionals, this may include profile information, uploaded
                  compliance documents, agreement status, and request activity.
                  For facilities, this may include administrative contact information,
                  shift data, and applicant review activity.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold tracking-tight text-slate-950">
                How We Use Information
              </h2>
              <div className="mt-4 space-y-4 text-base leading-8 text-slate-600">
                <p>
                  We use information to operate the staffing marketplace, support
                  onboarding, manage compliance workflows, process shift requests,
                  facilitate approvals and rejections, and improve the platform experience.
                </p>
                <p>
                  We may also use information for operational support, platform security,
                  account verification, communication, and recordkeeping related to staffing activity.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold tracking-tight text-slate-950">
                Compliance and Document Data
              </h2>
              <div className="mt-4 space-y-4 text-base leading-8 text-slate-600">
                <p>
                  Professional users may upload compliance-related documents to support
                  onboarding and eligibility workflows. These documents are used only
                  within the staffing process and related administrative review functions.
                </p>
                <p>
                  Facilities are shown only the compliance visibility needed for staffing
                  decisions and not unrelated internal business records.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold tracking-tight text-slate-950">
                Payroll Boundary
              </h2>
              <div className="mt-4 space-y-4 text-base leading-8 text-slate-600">
                <p>
                  Payroll functions are handled separately through the payroll portal.
                  The staffing platform may link users to payroll-related tools, but
                  payroll-specific processing and payment workflows are maintained outside
                  the staffing marketplace environment.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold tracking-tight text-slate-950">
                Data Security
              </h2>
              <div className="mt-4 space-y-4 text-base leading-8 text-slate-600">
                <p>
                  We take reasonable steps to protect platform data through access controls,
                  authenticated workflows, and system safeguards designed to reduce unauthorized access.
                </p>
                <p>
                  No method of storage or transmission is completely risk-free, but we work
                  to protect information used in the platform.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold tracking-tight text-slate-950">
                Contact
              </h2>
              <div className="mt-4 space-y-4 text-base leading-8 text-slate-600">
                <p>
                  For questions about this privacy policy or platform data practices,
                  please contact Wezen Staffing through the contact page.
                </p>
              </div>
            </section>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
