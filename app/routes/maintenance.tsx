import { redirect } from "react-router";

export function loader() {
  if (!process.env.MAINTENANCE_MODE) {
    return redirect("/", { status: 307 });
  }
  return {};
}

export default function MaintenancePage() {
  return (
    <main className="flex h-screen flex-col items-center justify-center">
      <h1 className="text-3xl font-bold">Under Maintenance</h1>
      <p className="mt-4 text-lg">We&apos;ll be back soon.</p>
    </main>
  );
}
