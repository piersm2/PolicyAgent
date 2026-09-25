import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card mx-auto max-w-md p-10 text-center">
      <div className="text-5xl font-bold text-slate-300">404</div>
      <h1 className="mt-2 text-lg font-semibold text-slate-900">Not found</h1>
      <p className="mt-1 text-sm text-slate-500">
        That policy or page doesn&apos;t exist. It may have been deleted.
      </p>
      <Link href="/" className="btn-primary mt-5">
        Back to dashboard
      </Link>
    </div>
  );
}
