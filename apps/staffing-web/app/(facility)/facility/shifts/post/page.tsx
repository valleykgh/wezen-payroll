import { PostShiftForm } from '@/components/facility/post-shift-form';

export default function PostShiftPage() {
  return (
    <div className="space-y-8">
      <div className="page-gradient rounded-[2rem] p-6">
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">
          Post Shift
        </div>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">
          Create a new shift and publish it to the marketplace
        </h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          Add the role, time, and facility requirements so qualified professionals can request coverage.
        </p>
      </div>

      <PostShiftForm />
    </div>
  );
}
